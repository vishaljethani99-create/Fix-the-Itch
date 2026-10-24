import { ProviderError, classifyProviderError } from './errors';
import type { ComposeRequest, ComposeResponse, Lang, SimplifyRequest, SimplifyResponse } from './types';

export const SERVER_TIMEOUT_MS = 10_000;
const DEFAULT_MODEL = 'gemma-4-26b-a4b-it';

const LANG_NAME: Record<Lang, string> = {
  en: 'English',
  hi: 'Hindi (Devanagari script)',
  mr: 'Marathi (Devanagari script)',
};

const isMock = () => process.env.MOCK_GEMMA === 'true';

function cleanJson(raw: string): Record<string, unknown> {
  const stripped = raw.replace(/```json|```/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Expected a JSON object');
  return parsed as Record<string, unknown>;
}

const isString = (v: unknown): v is string => typeof v === 'string';
function isSummary(v: unknown): v is { needs: string; symptoms: string; notes: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  return isString(s.needs) && isString(s.symptoms) && isString(s.notes);
}

/** Calls the model with a real abort signal so a timed-out request is actually cancelled. */
async function generate(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError('not_configured', 503, 'GEMINI_API_KEY is not set on the server (or set MOCK_GEMMA=true).');
  }
  const { GoogleGenAI } = await import('@google/genai'); // lazy: not loaded in mock mode
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMMA_MODEL || DEFAULT_MODEL;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, SERVER_TIMEOUT_MS);
  try {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { temperature: 0.2, abortSignal: ctrl.signal },
    });
    return res.text || '';
  } catch (err) {
    const classified = classifyProviderError(err, timedOut);
    // Log the category only: never the key, prompt, or conversation text.
    console.error(`[gemma] ${classified.code} (model=${model})`);
    throw classified;
  } finally {
    clearTimeout(timer);
  }
}

export async function runCompose(req: ComposeRequest): Promise<ComposeResponse> {
  const rawJoined = req.signs.join(' ');
  if (!req.signs.length) return { sentence: '', fallback: true, source: 'fallback' };

  if (isMock()) {
    return {
      sentence: `I need help with: ${rawJoined.toLowerCase()}.`,
      fallback: true,
      source: 'mock',
      summary: { needs: rawJoined, symptoms: '-', notes: 'Mock mode active' },
    };
  }

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
Do not invent medical or financial details not present in the signs. If the signs are unclear, keep the sentence tentative rather than guessing.`;

  const text = await generate(prompt);
  let parsed: Record<string, unknown>;
  try {
    parsed = cleanJson(text);
  } catch {
    throw new ProviderError('provider_error', 502, 'The language model returned an unreadable answer.');
  }
  if (!isString(parsed.sentence) || !parsed.sentence.trim() || !isSummary(parsed.summary)) {
    throw new ProviderError('provider_error', 502, 'The language model returned an invalid answer.');
  }
  return { sentence: parsed.sentence, summary: parsed.summary, fallback: false, source: 'live' };
}

export async function runSimplify(req: SimplifyRequest): Promise<SimplifyResponse> {
  if (!req.speech.trim()) {
    return { caption: '', keyTerms: [], quickReplies: ['OK', 'Wait', 'Help'], fallback: true, source: 'fallback' };
  }
  if (isMock()) {
    return {
      caption: req.speech,
      keyTerms: req.speech.split(' ').slice(0, 3),
      quickReplies: ['Yes', 'No', 'Please wait'],
      fallback: true,
      source: 'mock',
    };
  }

  const prompt = `A ${req.scenario} counter staff member said: ${JSON.stringify(req.speech)}.
Simplify this for a Deaf signer to read quickly in ${LANG_NAME[req.lang]}.
Reply ONLY with valid JSON:
{
  "caption": "Simple, clear 1-sentence summary (max 12 words)",
  "keyTerms": ["2 or 3 important words"],
  "quickReplies": ["3 short 1-3 word replies the Deaf user can tap"]
}`;

  const text = await generate(prompt);
  let parsed: Record<string, unknown>;
  try {
    parsed = cleanJson(text);
  } catch {
    throw new ProviderError('provider_error', 502, 'The language model returned an unreadable answer.');
  }
  if (
    !isString(parsed.caption) ||
    !Array.isArray(parsed.keyTerms) ||
    !parsed.keyTerms.every(isString) ||
    !Array.isArray(parsed.quickReplies) ||
    !parsed.quickReplies.every(isString)
  ) {
    throw new ProviderError('provider_error', 502, 'The language model returned an invalid answer.');
  }
  return {
    caption: parsed.caption || req.speech,
    keyTerms: parsed.keyTerms.slice(0, 4),
    quickReplies: parsed.quickReplies.slice(0, 3),
    fallback: false,
    source: 'live',
  };
}
