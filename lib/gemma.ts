import { GoogleGenAI } from '@google/genai';
import type { ComposeRequest, ComposeResponse, SimplifyRequest, SimplifyResponse, Lang } from './types';

const LANG_NAME: Record<Lang, string> = {
  en: 'English',
  hi: 'Hindi (Devanagari script)',
  mr: 'Marathi (Devanagari script)',
};

function cleanJson(raw: string): Record<string, unknown> {
  const stripped = raw.replace(/```json|```/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function isSummary(value: unknown): value is { needs: string; symptoms: string; notes: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const summary = value as Record<string, unknown>;
  return (
    typeof summary.needs === 'string' &&
    typeof summary.symptoms === 'string' &&
    typeof summary.notes === 'string'
  );
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export async function runCompose(req: ComposeRequest): Promise<ComposeResponse> {
  const rawJoined = req.signs.join(' ');
  if (!req.signs.length) return { sentence: '', fallback: true };

  if (process.env.MOCK_GEMMA === 'true' || !process.env.GEMINI_API_KEY) {
    return {
      sentence: `I need help with: ${rawJoined.toLowerCase()}.`,
      fallback: true,
      summary: { needs: rawJoined, symptoms: '-', notes: 'Mock mode active' },
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';

  const prompt = `You are assisting at a ${req.scenario} counter in India.
A Deaf person signed these words in order: ${JSON.stringify(req.signs)}.
Recent conversation: ${JSON.stringify(req.history.slice(-3))}.
Reply ONLY with valid JSON matching this exact structure in ${LANG_NAME[req.lang]}:
{
  "sentence": "Short polite first-person sentence (max 15 words) expressing only these signs",
  "summary": {
    "needs": "Main request in 2-4 words",
    "symptoms": "Any symptom/issue mentioned or 'None'",
    "notes": "Scenario: ${req.scenario}"
  }
}
Do not invent medical or financial details not present in the signs.`;

  try {
    const res = await Promise.race([
      ai.models.generateContent({ model, contents: prompt, config: { temperature: 0.2 } }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout')), 5500)),
    ]);
    const parsed = cleanJson(res.text || '');
    if (typeof parsed.sentence !== 'string' || !isSummary(parsed.summary)) {
      throw new Error('Gemma returned an invalid compose response');
    }
    return {
      sentence: parsed.sentence || rawJoined,
      summary: parsed.summary,
      fallback: false,
    };
  } catch {
    return { sentence: rawJoined, fallback: true };
  }
}

export async function runSimplify(req: SimplifyRequest): Promise<SimplifyResponse> {
  if (!req.speech.trim()) {
    return { caption: '', keyTerms: [], quickReplies: ['OK', 'Wait', 'Help'], fallback: true };
  }

  if (process.env.MOCK_GEMMA === 'true' || !process.env.GEMINI_API_KEY) {
    return {
      caption: req.speech,
      keyTerms: req.speech.split(' ').slice(0, 3),
      quickReplies: ['Yes', 'No', 'Please wait'],
      fallback: true,
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';

  const prompt = `A ${req.scenario} counter staff member said: "${req.speech}".
Simplify this for a Deaf signer to read quickly in ${LANG_NAME[req.lang]}.
Reply ONLY with valid JSON:
{
  "caption": "Simple, clear 1-sentence summary (max 12 words)",
  "keyTerms": ["2 or 3 important words"],
  "quickReplies": ["3 short 1-3 word replies the Deaf user can tap"]
}`;

  try {
    const res = await Promise.race([
      ai.models.generateContent({ model, contents: prompt, config: { temperature: 0.2 } }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout')), 5500)),
    ]);
    const parsed = cleanJson(res.text || '');
    if (
      typeof parsed.caption !== 'string' ||
      !Array.isArray(parsed.keyTerms) ||
      !parsed.keyTerms.every(isString) ||
      !Array.isArray(parsed.quickReplies) ||
      !parsed.quickReplies.every(isString)
    ) {
      throw new Error('Gemma returned an invalid simplify response');
    }
    return {
      caption: parsed.caption || req.speech,
      keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms.slice(0, 4) : [],
      quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 3) : ['Yes', 'No', 'Help'],
      fallback: false,
    };
  } catch {
    return {
      caption: req.speech,
      keyTerms: [],
      quickReplies: ['Yes', 'No', 'Please repeat'],
      fallback: true,
    };
  }
}