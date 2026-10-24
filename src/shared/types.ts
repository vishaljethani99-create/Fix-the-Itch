
export type CounterMode = "hospital" | "bank";

export interface SignToken {
  label: string;
  confidence: number;
  timestamp: number;
}

export interface ConversationTurn {
  speaker: "signer" | "staff";
  text: string;
  timestamp: number;
}

export interface GemmaRequest {
  tokens: SignToken[];
  mode: CounterMode;
  lastTurns: ConversationTurn[];
}

export interface GemmaResponse {
  spokenText: string;
  staffReplies: string[];
}
