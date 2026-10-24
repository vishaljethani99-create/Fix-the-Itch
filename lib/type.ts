export type Scenario = 'hospital' | 'bank' | 'office';
export type Lang = 'en' | 'hi' | 'mr';
export type Turn = { who: 'signer' | 'staff'; text: string };
export type RecognizedSign = { label: string; confidence: number; at: number };

export type ComposeRequest = {
  signs: string[];
  scenario: Scenario;
  lang: Lang;
  history: Turn[];
};

export type ComposeResponse = {
  sentence: string;
  fallback?: boolean;
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
};