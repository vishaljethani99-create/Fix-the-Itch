'use client';
import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import HandsAvatarJs from './HandsAvatar';
import HandsAvatar3DJs from './HandsAvatar3D';
import { interpret } from './signLibrary';
import { createRecognizer } from '../lib/vision/recognizer';
import type { Landmark, SignRecognizer } from '../lib/vision/types';
import { createSession } from '../lib/session';
import type { Session } from '../lib/session';
import { LANGS, SCENARIOS } from '../lib/types';
import type { ComposeResponse, Lang, Scenario } from '../lib/types';

type AvatarProps = { names: string[]; playKey: number; onError?: () => void };
const HandsAvatar = HandsAvatarJs as unknown as ComponentType<AvatarProps>;
const HandsAvatar3D = HandsAvatar3DJs as unknown as ComponentType<AvatarProps>;

type SpeechRec = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
};
type SpeechWin = Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec; webkitAudioContext?: typeof AudioContext };

const TRY = ['Hi, how are you?', 'The dog is running', 'My back hurts and neck is swelling', 'Suicide'];
const LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

export default function Studio({ stream }: { stream: MediaStream }) {
  const vid = useRef<HTMLVideoElement>(null);
  const meter = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const reco = useRef<SignRecognizer | null>(null);
  const session = useRef<Session | null>(null);
  const seen = useRef(false);

  const [scenario, setScenario] = useState<Scenario>('hospital');
  const [lang, setLang] = useState<Lang>('en');
  const [chat, setChat] = useState<{ who: string; text: string }[]>([]);
  const [seq, setSeq] = useState({ names: [] as string[], key: 0 });
  const [care, setCare] = useState(false);
  const [heard, setHeard] = useState('');
  const [signed, setSigned] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ComposeResponse | null>(null);
  const [vision, setVision] = useState<'loading' | 'on' | 'error'>('loading');
  const [visionErr, setVisionErr] = useState('');
  const [packMsg, setPackMsg] = useState('');
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [hand, setHand] = useState(false);
  const [label, setLabel] = useState('');
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState('');
  const [taught, setTaught] = useState(0);

  const handle = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const r = interpret(t) as { reply: string; signs: string[]; care?: boolean };
    setChat((c) => [...c.slice(-5), { who: 'you', text: t }, { who: 'bridge', text: r.reply }]);
    setSeq({ names: r.signs, key: Date.now() });
    setCare(!!r.care);
  };

  // keep the session in sync with the selectors without tearing down the camera
  useEffect(() => { session.current?.configure({ scenario, lang }); }, [scenario, lang]);

  // attach the already-granted stream (must run before the recognizer effect below)
  useEffect(() => { if (vid.current) vid.current.srcObject = stream; }, [stream]);

  // microphone level meter
  useEffect(() => {
    const AC = window.AudioContext || (window as SpeechWin).webkitAudioContext;
    if (!AC || !stream.getAudioTracks().length) return;
    const ctx = new AC();
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    let raf = 0;
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let m = 0; buf.forEach((v) => (m = Math.max(m, Math.abs(v - 128))));
      if (meter.current) meter.current.style.width = Math.min(100, m * 1.6) + '%';
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); void ctx.close(); };
  }, [stream]);

  // speech -> hands
  useEffect(() => {
    const w = window as SpeechWin;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    let on = true;
    let current: SpeechRec | null = null;
    const start = () => {
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = LOCALE[lang];
      r.onresult = (e) => {
        let live = '';
        for (let k = e.resultIndex; k < e.results.length; k++) {
          const res = e.results[k];
          live += res[0].transcript;
          if (res.isFinal) { if (!window.speechSynthesis?.speaking) handle(res[0].transcript); live = ''; }
        }
        setHeard(live);
      };
      r.onend = () => { if (on) setTimeout(start, 300); };
      r.onerror = () => {};
      current = r;
      try { r.start(); } catch { /* already started */ }
    };
    start();
    return () => { on = false; current?.stop(); };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // camera -> landmarks -> sign labels (on device) -> validated /api/compose -> spoken sentence
  useEffect(() => {
    const s = createSession({
      scenario, lang,
      onSigns: setSigned,
      onSentence: (r) => {
        setResult(r);
        if (r.sentence && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(r.sentence);
          u.lang = LOCALE[lang];
          window.speechSynthesis.speak(u);
        }
      },
    });
    session.current = s;
    const r = createRecognizer();
    reco.current = r;
    let dead = false;

    r.onSign((sign) => s.push(sign));
    r.onLandmarks((hands: Landmark[][]) => {
      const c = overlay.current, v = vid.current;
      if (!c || !v || !v.videoWidth) return;
      if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = '#FFB020';
      hands.forEach((h) => h.forEach((p) => { g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 5, 0, Math.PI * 2); g.fill(); }));
      const has = hands.length > 0;
      if (has !== seen.current) { seen.current = has; setHand(has); }
    });

    // 1) load + validate the sign pack (a bad pack is reported, never silently ignored)
    fetch('/packs/default.json')
      .then((x) => { if (!x.ok) throw new Error(`HTTP ${x.status}`); return x.json(); })
      .then((p) => { r.loadPack(p); setPackMsg(''); })
      .catch((e) => setPackMsg(`Sign pack not loaded: ${e instanceof Error ? e.message : String(e)}`));

    // 2) start camera + MediaPipe (reuses the stream already attached to the <video>)
    if (vid.current) {
      r.start(vid.current)
        .then(() => { if (!dead) setVision('on'); })
        .catch((e: unknown) => { if (!dead) { setVisionErr(e instanceof Error ? e.message : String(e)); setVision('error'); } });
    }
    return () => { dead = true; r.stop(); s.reset(); session.current = null; reco.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const record = () => {
    const r = reco.current; if (!r || recording) return;
    r.startClip(); setRecording(true);
    setTimeout(() => { setPreview(r.stopClip().previewUrl); setRecording(false); }, 1500);
  };
  const save = () => {
    if (!label.trim()) { setPackMsg('Type a label first.'); return; }
    reco.current?.saveClip(label); setPreview(''); setTaught((n) => n + 1); setPackMsg(`Saved ${label.trim().toUpperCase()}.`);
  };
  const download = () => {
    if (!reco.current) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(reco.current.exportPack())], { type: 'application/json' }));
    a.download = 'default.json'; a.click();
  };

  const sourceNote = !result ? null
    : result.source === 'live' ? 'AI-composed (live Gemma)'
    : result.source === 'mock' ? 'Demo text (mock mode) — not AI-composed'
    : `Fallback: showing the raw signs, not an AI-composed sentence${result.error ? ` — ${result.error}` : ''}`;

  return (
    <>
      <div className="sec-head">
        <h2>Your interpreter is live</h2>
        <p>Say “hi, how are you?”, sign into the camera, or tap an example.</p>
      </div>
      <div className="tryrow">
        <label>Scenario{' '}
          <select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
            {SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Language{' '}
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="studio-grid">
        <div className="studio-col">
          <div className="cam">
            <video ref={vid} autoPlay playsInline muted /><canvas ref={overlay} />
            <div className="hand-status">{vision !== 'on' ? 'Starting hand tracking…' : hand ? 'Hand detected' : 'No hand in view'}</div>
            <div className="mic"><i ref={meter} /></div>
          </div>
          <h3>You signed</h3>
          <div className="out" aria-live="polite">
            {signed.length ? signed.join(' · ') : (
              <span className="dim">
                {vision === 'error' ? `Hand tracking could not start: ${visionErr}` : vision === 'on' ? 'Show a sign to the camera…' : 'Loading on-device hand tracking…'}
              </span>
            )}
          </div>
          {result?.sentence && <div className="msg bridge">{result.sentence}</div>}
          {sourceNote && <div className="dim" role="status">{sourceNote}</div>}
          {packMsg && <div className="dim" role="status">{packMsg}</div>}
          <div className="ask">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Teach a sign, e.g. HELP" aria-label="Sign label" />
            <button className="btn btn-ghost" type="button" disabled={recording || vision !== 'on'} onClick={record}>{recording ? 'Recording… 1.5 s' : '● Record'}</button>
          </div>
          {preview && <div><img src={preview} width={240} alt="Clip preview" /></div>}
          <div className="tryrow">
            <button type="button" className="chip" disabled={!preview} onClick={save}>Save clip</button>
            <button type="button" className="chip" disabled={!preview} onClick={() => { reco.current?.discardClip(); setPreview(''); }}>Discard</button>
            <button type="button" className="chip" disabled={!taught} onClick={download}>Download pack ({taught})</button>
          </div>
        </div>
        <div className="studio-col">
          {mode === '3d'
            ? <HandsAvatar3D names={seq.names} playKey={seq.key} onError={() => setMode('2d')} />
            : <HandsAvatar names={seq.names} playKey={seq.key} />}
          <button type="button" className="chip" onClick={() => setMode(mode === '3d' ? '2d' : '3d')}>
            {mode === '3d' ? 'Switch to 2D' : 'Switch to 3D'}
          </button>
          <div className="out heard">{heard || <span className="dim">Listening… say “hi, how are you?”</span>}</div>
          <div className="chat" aria-live="polite">
            {chat.map((m, i) => <div key={i} className={`msg ${m.who}`}>{m.text}</div>)}
          </div>
          {care && (
            <div className="care" role="note">
              <b>You’re not alone.</b> If you or someone near you is thinking about suicide, please reach out now. In India, Tele-MANAS is free and open 24/7:
              call <a href="tel:14416">14416</a> or <a href="tel:18008914416">1-800-891-4416</a>. If someone is in immediate danger, call 112.
            </div>
          )}
          <div className="tryrow">{TRY.map((t) => <button key={t} type="button" className="chip" onClick={() => handle(t)}>{t}</button>)}</div>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); handle(text); setText(''); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type a phrase…" aria-label="Type a phrase" />
            <button className="btn btn-primary" type="submit">Sign it</button>
          </form>
        </div>
      </div>
    </>
  );
}
