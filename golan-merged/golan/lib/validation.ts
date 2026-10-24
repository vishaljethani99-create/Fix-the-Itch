import { LANGS, ROLES, SCENARIOS } from './types';
import type { ComposeRequest, Lang, Role, Scenario, SimplifyRequest, Turn } from './types';

export const MAX_BODY_BYTES = 32_000;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);
const isScenario = (v: unknown): v is Scenario =>
  typeof v === 'string' && (SCENARIOS as readonly string[]).includes(v);
const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v);

function parseTurn(value: unknown): Turn | null {
  if (!isRecord(value) || !isRole(value.who)) return null;
  if (typeof value.text !== 'string' || value.text.length > 1000) return null;
  // Rebuild the object so unexpected keys never reach the model prompt.
  return { who: value.who, text: value.text };
}

export function parseComposeRequest(value: unknown): ComposeRequest | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.signs) || value.signs.length > 100) return null;
  const signs: string[] = [];
  for (const s of value.signs) {
    if (typeof s !== 'string' || s.trim().length === 0 || s.length > 100) return null;
    signs.push(s);
  }
  if (!isScenario(value.scenario) || !isLang(value.lang)) return null;
  if (!Array.isArray(value.history) || value.history.length > 20) return null;
  const history: Turn[] = [];
  for (const t of value.history) {
    const turn = parseTurn(t);
    if (!turn) return null;
    history.push(turn);
  }
  return { signs, scenario: value.scenario, lang: value.lang, history };
}

export function parseSimplifyRequest(value: unknown): SimplifyRequest | null {
  if (
    !isRecord(value) ||
    typeof value.speech !== 'string' ||
    value.speech.length > 4000 ||
    !isScenario(value.scenario) ||
    !isLang(value.lang)
  ) {
    return null;
  }
  return { speech: value.speech, scenario: value.scenario, lang: value.lang };
}
