import type { ComposeRequest, Lang, Scenario, SimplifyRequest, Turn } from './types';

const LANGS = new Set<Lang>(['en', 'hi', 'mr']);
const SCENARIOS = new Set<Scenario>(['hospital', 'bank', 'office']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && LANGS.has(value as Lang);
}

function isScenario(value: unknown): value is Scenario {
  return typeof value === 'string' && SCENARIOS.has(value as Scenario);
}

function isTurn(value: unknown): value is Turn {
  return (
    isRecord(value) &&
    (value.who === 'signer' || value.who === 'staff') &&
    typeof value.text === 'string' &&
    value.text.length <= 1000
  );
}

export function parseComposeRequest(value: unknown): ComposeRequest | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.signs) || value.signs.length > 100) return null;
  if (
    !value.signs.every(
      (sign) => typeof sign === 'string' && sign.trim().length > 0 && sign.length <= 100
    )
  ) {
    return null;
  }
  if (!isScenario(value.scenario) || !isLang(value.lang)) return null;
  if (
    !Array.isArray(value.history) ||
    value.history.length > 20 ||
    !value.history.every(isTurn)
  ) {
    return null;
  }

  return {
    signs: value.signs,
    scenario: value.scenario,
    lang: value.lang,
    history: value.history,
  };
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

  return {
    speech: value.speech,
    scenario: value.scenario,
    lang: value.lang,
  };
}
