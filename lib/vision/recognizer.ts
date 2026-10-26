import type { Landmark, SignPack, SignRecognizer, SignExample } from './types';
import { CLIP_FRAMES, CLIP_MS, normalizeFrame, resample } from './normalize';
import { Matcher, type Match } from './matcher';
import { buildPreviewUrl } from './preview';
import { parseSignPack } from './pack';

type RecognizedSign = Parameters<Parameters<SignRecognizer['onSign']>[0]>[0];

// Self-hosted first (works with bad venue Wi-Fi), CDN only as fallback.
const LOCAL_WASM = '/mediapipe/wasm';
const LOCAL_MODEL = '/mediapipe/hand_landmarker.task';
// Keep this version identical to the installed @mediapipe/tasks-vision (JS and WASM must match).
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const CDN_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const MIN_HAND_FRAMES = 8;

export interface RecognizerOptions {
  intervalMs?: number;   // detection throttle, default 65 (~15 FPS)
  holdFrames?: number;   // consecutive matching frames before a sign fires, default 8
  cooldownMs?: number;   // min gap between emitted signs, default 900
  threshold?: number;    // matcher distance threshold, default 0.18
  facingMode?: 'user' | 'environment';
}

type Frame = { t: number; vec: number[]; has: boolean; raw: Landmark[][] };

export class VisionRecognizer implements SignRecognizer {
  private o: Required<RecognizerOptions>;
  private matcher: Matcher;
  private video: HTMLVideoElement | null = null;
  private landmarker: any = null;
  private raf = 0;
  private lastRun = 0;
  private lastVideoTime = -1;
  private window: Frame[] = [];
  private streakLabel: string | null = null;
  private streak = 0;
  private locked: string | null = null;
  private missing = 0;
  private lastEmit = 0;
  private signCbs = new Set<(s: RecognizedSign) => void>();
  private lmCbs = new Set<(h: Landmark[][]) => void>();
  private debugCbs = new Set<(m: Match | null, handsSeen: number) => void>();
  private examples: SignExample[] = [];
  private packName = 'sanket-signs';
  private clipping = false;
  private clip: Frame[] = [];
  private clipFinal: Frame[] = [];
  private previewUrl = '';
  private ownsStream = false;
  private startToken = 0;

  constructor(opts: RecognizerOptions = {}) {
    this.o = { intervalMs: 65, holdFrames: 8, cooldownMs: 900, threshold: 0.18, facingMode: 'user', ...opts };
    this.matcher = new Matcher(this.o.threshold);
  }

  /**
   * Starts detection on `video`. If the element already has a live camera MediaStream attached
   * (e.g. the page already asked for permission) it is reused and NOT stopped by stop();
   * otherwise a stream is opened here and owned (and always released) by this recognizer.
   */
  async start(video: HTMLVideoElement): Promise<void> {
    this.stop();
    const token = ++this.startToken;
    const cancelled = () => token !== this.startToken;
    this.video = video;
    let opened: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not available. Use localhost or HTTPS in a modern browser.');
      }
      const existing = typeof MediaStream !== 'undefined' && video.srcObject instanceof MediaStream ? video.srcObject : null;
      if (existing && existing.getVideoTracks().some((t) => t.readyState === 'live')) {
        this.ownsStream = false;
      } else {
        opened = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.o.facingMode, width: 640, height: 480 },
          audio: false,
        });
        if (cancelled()) { opened.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = opened;
        this.ownsStream = true;
      }
      video.muted = true;
      video.playsInline = true;
      await video.play();
      const landmarker = await this.createLandmarker();
      if (cancelled()) { landmarker.close?.(); return; }
      this.landmarker = landmarker;
    } catch (e) {
      // Release anything acquired by this attempt, then surface a readable error.
      opened?.getTracks().forEach((t) => t.stop());
      if (this.ownsStream && this.video?.srcObject === opened) this.video.srcObject = null;
      if (!cancelled()) this.landmarker = null;
      throw new Error(describeStartError(e));
    }
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - this.lastRun < this.o.intervalMs) return;
      if (!this.video || !this.landmarker || this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime) return;
      this.lastRun = now;
      this.lastVideoTime = this.video.currentTime;
      const res = this.landmarker.detectForVideo(this.video, now);
      const hands: Landmark[][] = (res.landmarks ?? []).map((h: any[]) => h.map((p) => ({ x: p.x, y: p.y, z: p.z })));
      const hd = res.handedness ?? res.handednesses ?? [];
      const labels: string[] = hands.map((_, i) => hd[i]?.[0]?.categoryName ?? 'Right');
      this.processFrame(hands, labels, now);
    };
    loop();
  }

  private async createLandmarker() {
    const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const build = async (wasm: string, model: string) => {
      const fileset = await FilesetResolver.forVisionTasks(wasm);
      const make = (delegate: 'GPU' | 'CPU') =>
        HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO', numHands: 2 });
      try { return await make('GPU'); } catch { return await make('CPU'); }
    };
    try { return await build(LOCAL_WASM, LOCAL_MODEL); }
    catch (e) { console.warn('Local MediaPipe assets missing, using CDN', e); return await build(CDN_WASM, CDN_MODEL); }
  }

  stop(): void {
    this.startToken++; // invalidates any start() still awaiting
    cancelAnimationFrame(this.raf);
    if (this.ownsStream) {
      (this.video?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      if (this.video) this.video.srcObject = null;
    }
    this.ownsStream = false;
    this.landmarker?.close?.();
    this.landmarker = null;
    this.window = []; this.streak = 0; this.streakLabel = null; this.locked = null;
  }

  private processFrame(hands: Landmark[][], labels: string[], now: number) {
    this.lmCbs.forEach((cb) => cb(hands));
    const aspect = (this.video!.videoWidth || 4) / (this.video!.videoHeight || 3);
    const { vec, has } = normalizeFrame(hands, labels, aspect);
    const frame: Frame = { t: now, vec, has, raw: hands };

    if (this.clipping) {
      this.clip.push(frame);
      while (this.clip.length && now - this.clip[0].t > 3000) this.clip.shift();
      return; // no sign emission while teaching
    }
    this.window.push(frame);
    while (this.window.length && now - this.window[0].t > CLIP_MS) this.window.shift();
    this.detect(has);
  }

  // ~1.5 s clip -> 16 frames. Leading empty frames are dropped so a sign can fire as soon as the hand is in.
  private liveClip(): number[][] | null {
    const i = this.window.findIndex((f) => f.has);
    if (i < 0) return null;
    const f = this.window.slice(i);
    if (f.length < MIN_HAND_FRAMES || !f[f.length - 1].has) return null;
    return resample(f.map((x) => x.vec));
  }

  private detect(hasHand: boolean) {
    if (!hasHand) {
      this.streak = 0; this.streakLabel = null;
      if (++this.missing >= 6) this.locked = null; // hand left the frame -> same sign may fire again
      this.debugCbs.forEach((cb) => cb(null, 0));
      return;
    }
    this.missing = 0;
    const clip = this.liveClip();
    const m = clip ? this.matcher.match(clip) : null;
    this.debugCbs.forEach((cb) => cb(m, 1));
    if (!m) { this.streak = 0; this.streakLabel = null; return; }
    if (m.label === this.streakLabel) this.streak++; else { this.streakLabel = m.label; this.streak = 1; }
    const now = performance.now();
    if (this.streak >= this.o.holdFrames && m.label !== this.locked && now - this.lastEmit > this.o.cooldownMs) {
      this.locked = m.label;
      this.lastEmit = now;
      const sign: RecognizedSign = { label: m.label, confidence: m.confidence, at: Date.now() };
      this.signCbs.forEach((cb) => cb(sign));
    }
  }

  onSign(cb: (s: RecognizedSign) => void) { this.signCbs.add(cb); return () => { this.signCbs.delete(cb); }; }
  onLandmarks(cb: (h: Landmark[][]) => void) { this.lmCbs.add(cb); return () => { this.lmCbs.delete(cb); }; }
  // extra (not in the contract): live distances for threshold tuning
  onDebug(cb: (m: Match | null, handsSeen: number) => void) { this.debugCbs.add(cb); return () => { this.debugCbs.delete(cb); }; }

  /** Validates the pack (throws a readable Error if malformed) before using it. */
  loadPack(input: SignPack) {
    const pack = parseSignPack(input);
    this.examples = [...pack.examples];
    this.packName = pack.name;
    this.matcher.setExamples(this.examples);
  }
  exportPack(): SignPack { return { version: 1, name: this.packName, examples: this.examples }; }

  // Keep the last 1.5 s, trimmed of empty frames at both ends.
  private finalize(): Frame[] {
    if (this.clip.length === 0) return [];
    const end = this.clip[this.clip.length - 1].t;
    const f = this.clip.filter((x) => end - x.t <= CLIP_MS);
    while (f.length && !f[0].has) f.shift();
    while (f.length && !f[f.length - 1].has) f.pop();
    return f;
  }

  startClip() { this.discardClip(); this.clipping = true; }
  stopClip() {
    this.clipping = false;
    this.clipFinal = this.finalize();
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = buildPreviewUrl(this.clipFinal.map((f) => f.raw));
    return { previewUrl: this.previewUrl };
  }
  saveClip(label: string) {
    if (this.clipping) this.stopClip();
    if (this.clipFinal.length < 4) { console.warn('Clip too short / no hand seen, not saved'); this.discardClip(); return; }
    this.examples.push({ label: label.trim().toUpperCase(), frames: resample(this.clipFinal.map((f) => f.vec), CLIP_FRAMES) });
    this.matcher.setExamples(this.examples);
    this.discardClip();
  }
  discardClip() {
    this.clipping = false; this.clip = []; this.clipFinal = [];
    this.window = []; this.streak = 0; this.streakLabel = null;
    if (this.previewUrl) { URL.revokeObjectURL(this.previewUrl); this.previewUrl = ''; }
  }
}

function describeStartError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was denied. Allow camera access in the browser and try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No usable camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is in use by another application.';
  return e instanceof Error ? e.message : String(e);
}

export function createRecognizer(opts?: RecognizerOptions): SignRecognizer { return new VisionRecognizer(opts); }
