import { composeSigns } from './api';

type ComposeInput = Parameters<typeof composeSigns>[0];
type ComposeResponse = Awaited<ReturnType<typeof composeSigns>>;
type Lang = ComposeInput['lang'];
type Scenario = ComposeInput['scenario'];
type RecognizedSign = { label: string };
type Turn = NonNullable<ComposeInput['history']>[number];

export function createSession(opts: {
  scenario: Scenario;
  lang: Lang;
  onSigns: (signs: string[]) => void;
  onSentence: (r: ComposeResponse) => void;
}): { push(sign: RecognizedSign): void; reset(): void } {
  let buffer: string[] = [];
  let history: Turn[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  const flush = async () => {
    timer = null;
    if (buffer.length === 0) return;
    const signsToSend = [...buffer];
    const requestGeneration = generation;
    buffer = [];
    opts.onSigns([]);

    const res = await composeSigns({
      signs: signsToSend,
      scenario: opts.scenario,
      lang: opts.lang,
      history,
    });

    if (requestGeneration !== generation) return;
    if (res.sentence) {
      history = [...history.slice(-5), { who: 'signer', text: res.sentence }];
    }
    opts.onSentence(res);
  };

  return {
    push(sign: RecognizedSign) {
      // Avoid duplicate spam if the same sign triggers twice in a row
      if (buffer[buffer.length - 1] !== sign.label) {
        buffer.push(sign.label);
        opts.onSigns([...buffer]);
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 1500);
    },
    reset() {
      generation += 1;
      if (timer) clearTimeout(timer);
      timer = null;
      buffer = [];
      opts.onSigns([]);
    },
  };
}