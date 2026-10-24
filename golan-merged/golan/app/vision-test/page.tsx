'use client';
// Member 1's private test harness. Not part of the product UI; delete before final freeze if you like.
import { useEffect, useRef, useState } from 'react';
import { createRecognizer } from '@/lib/vision/recognizer';
import type { SignRecognizer } from '@/lib/vision/types';

export default function VisionTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rec = useRef<SignRecognizer | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [debug, setDebug] = useState('');
  const [label, setLabel] = useState('HELP');
  const [preview, setPreview] = useState('');
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const r = createRecognizer();
    rec.current = r;
    r.onSign((s: any) => setLog((l) => [`${s.label} (${Math.round((s.confidence ?? 0) * 100)}%)`, ...l].slice(0, 8)));
    r.onLandmarks((hands) => {
      const c = canvasRef.current, v = videoRef.current; if (!c || !v) return;
      c.width = v.videoWidth; c.height = v.videoHeight;
      const g = c.getContext('2d')!; g.clearRect(0, 0, c.width, c.height); g.fillStyle = '#22d3ee';
      hands.forEach((h) => h.forEach((p) => { g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 4, 0, 7); g.fill(); }));
    });
    (r as any).onDebug((m: any, n: number) => setDebug(`hands:${n} ${m ? `${m.label} d=${m.distance.toFixed(3)}` : 'no match'}`));
    fetch('/packs/default.json').then((x) => x.json()).then((p) => r.loadPack(p)).catch((e) => setDebug(`Pack not loaded: ${e instanceof Error ? e.message : String(e)}`));
    return () => r.stop();
  }, []);

  const download = () => {
    const blob = new Blob([JSON.stringify(rec.current!.exportPack())], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'default.json'; a.click();
  };

  return (
    <main style={{ padding: 12, fontFamily: 'sans-serif' }}>
      <div style={{ position: 'relative', maxWidth: 480 }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
      </div>
      <p><button onClick={() => rec.current!.start(videoRef.current!).catch((e: unknown) => setDebug(`Camera/vision error: ${e instanceof Error ? e.message : String(e)}`))}>Start camera</button></p>
      <p>{debug}</p>
      <input value={label} onChange={(e) => setLabel(e.target.value)} />
      <button disabled={recording} onClick={() => { rec.current!.startClip(); setRecording(true); setTimeout(() => { setPreview(rec.current!.stopClip().previewUrl); setRecording(false); }, 1500); }}>{recording ? 'Recording… 1.5 s' : '● Record 1.5 s'}</button>
      <button onClick={() => { rec.current!.saveClip(label); setPreview(''); }}>Save</button>
      <button onClick={() => { rec.current!.discardClip(); setPreview(''); }}>Discard</button>
      <button onClick={download}>Export pack JSON</button>
      {preview && <div><img src={preview} width={320} alt="clip preview" /></div>}
      <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </main>
  );
}
