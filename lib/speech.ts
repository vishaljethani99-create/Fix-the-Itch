import type { Lang } from './types';

const BCP47: Record<Lang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

type RecognitionResult = {
  0: { transcript: string };
  length: number;
};

type RecognitionEvent = {
  results: ArrayLike<RecognitionResult>;
};

type RecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type RecognitionConstructor = new () => RecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

export function speak(text: string, lang: Lang): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = BCP47[lang] || 'en-IN';
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

export function listen(
  lang: Lang,
  onResult: (text: string) => void,
  onEnd: () => void
): () => void {
  if (typeof window === 'undefined') {
    onEnd();
    return () => {};
  }
  const speechWindow = window as SpeechWindow;
  const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  if (!SR) {
    onEnd();
    return () => {};
  }

  const rec = new SR();
  rec.lang = BCP47[lang] || 'en-IN';
  rec.interimResults = true;
  rec.continuous = false;

  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    onEnd();
  };

  rec.onresult = (event: RecognitionEvent) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    onResult(transcript.trim());
  };
  rec.onerror = finish;
  rec.onend = finish;

  try {
    rec.start();
  } catch {
    finish();
  }
  return () => {
    try {
      rec.stop();
    } catch {
      finish();
    }
  };
}