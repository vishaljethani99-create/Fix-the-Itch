// Single source of truth for the request/response contract shared by client and server.
export const SCENARIOS = ['hospital', 'bank', 'office'] as const;
export const LANGS = ['en', 'hi', 'mr'] as const;
export const ROLES = ['signer', 'staff'] as const;

export type Scenario = (typeof SCENARIOS)[number];
export type Lang = (typeof LANGS)[number];
export type Role = (typeof ROLES)[number];
export type Turn = { who: Role; text: string };
export type RecognizedSign = { label: string; confidence: number; at: number };

export type ComposeRequest = {
  signs: string[];
  scenario: Scenario;
  lang: Lang;
  history: Turn[];
};

/** live = real Gemma answer, mock = MOCK_GEMMA demo text, fallback = raw signs because composition failed. */
export type ResponseSource = 'live' | 'mock' | 'fallback';

export type ComposeResponse = {
  sentence: string;
  /** true for anything that is NOT a confirmed live model answer (kept for compatibility). */
  fallback?: boolean;
  source?: ResponseSource;
  /** set by the client when it had to fall back; a short, safe description. */
  error?: string;
  summary?: { needs: string; symptoms: string; notes: string };
};

export type SimplifyRequest = {
  speech: string;
  scenario: Scenario;
  lang: Lang;
};

export type SimplifyResponse = {
  caption: string;
  keyTerms: string[];
  quickReplies: string[];
  fallback?: boolean;
  source?: ResponseSource;
  error?: string;
};

/** Stable error body returned by the API routes for every non-2xx response. */
export type ApiErrorCode =
  | 'invalid_json'
  | 'invalid_request'
  | 'payload_too_large'
  | 'not_configured'
  | 'provider_auth'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error';
export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };
