import { composeSigns } from './api';
import type { ComposeRequest, ComposeResponse, RecognizedSign, Turn } from './types';

export const PAUSE_MS = 1500;
const MAX_HISTORY = 6;

export type Session = {
  push(sign: Pick<RecognizedSign, 'label'>): void;
  reset(): void;
  /** Update scenario/language without rebuilding the session (keeps the pause timer and history). */
  configure(next: Partial<Pick<ComposeRequest, 'scenario' | 'lang'>>): void;
};

export function createSession(opts: {
  scenario: ComposeRequest['scenario'];
  lang: ComposeRequest['lang'];
  pauseMs?: number;
  onSigns: (signs: string[]) => void;
  onSentence: (r: ComposeResponse) => void;
}): Session {
  let scenario = opts.scenario;
  let lang = opts.lang;
  let buffer: string[] = [];
  let history: Turn[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  const flush = async () => {
    timer = null;
    if (buffer.length === 0) return;
    const signs = [...buffer];
    const myGeneration = generation;
    buffer = [];
    opts.onSigns([]);

    const res = await composeSigns({ signs, scenario, lang, history });

    if (myGeneration !== generation) return; // session was reset while the request was in flight
    // Only a live model answer is recorded as something the signer "said".
    if (res.source === 'live' && res.sentence) {
      history = [...history, { who: 'signer' as const, text: res.sentence }].slice(-MAX_HISTORY);
    }
    opts.onSentence(res);
  };

  return {
    push(sign) {
      if (buffer[buffer.length - 1] !== sign.label) {
        buffer.push(sign.label);
        opts.onSigns([...buffer]);
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, opts.pauseMs ?? PAUSE_MS);
    },
    reset() {
      generation += 1;
      if (timer) clearTimeout(timer);
      timer = null;
      buffer = [];
      history = [];
      opts.onSigns([]);
    },
    configure(next) {
      if (next.scenario) scenario = next.scenario;
      if (next.lang) lang = next.lang;
    },
  };
}
