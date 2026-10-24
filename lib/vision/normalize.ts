import type { Landmark } from './types';

export const POINTS = 21;
export const DIM = POINTS * 3;      // 63 values per frame (one hand)
export const CLIP_FRAMES = 16;
export const CLIP_MS = 1500;
// Left hands are mirrored to look like right hands (spec section 5).
// Left and right always get opposite labels, so flipping either one makes them match.
export const MIRROR_LABEL = 'Left';

const MIDDLE_KNUCKLE = 9;

function handSize(h: Landmark[], aspect: number): number {
  const w = h[0], k = h[MIDDLE_KNUCKLE];
  return Math.hypot((k.x - w.x) * aspect, k.y - w.y, (k.z - w.z) * aspect);
}

// Subtract wrist, divide by hand size (wrist -> middle knuckle), mirror left to right.
// aspect = videoWidth / videoHeight so x and y use the same units on every phone.
export function normalizeHand(h: Landmark[], mirror: boolean, aspect: number): number[] {
  const w = h[0];
  const s = Math.max(handSize(h, aspect), 1e-6);
  const out: number[] = [];
  for (const p of h) {
    const x = (p.x - w.x) * aspect;
    out.push((mirror ? -x : x) / s, (p.y - w.y) / s, ((p.z - w.z) * aspect) / s);
  }
  return out;
}

// One hand per frame: if two are visible, use the larger (closer) one.
export function normalizeFrame(hands: Landmark[][], labels: string[], aspect: number): { vec: number[]; has: boolean } {
  if (hands.length === 0) return { vec: new Array(DIM).fill(0), has: false };
  let best = 0;
  for (let i = 1; i < hands.length; i++) if (handSize(hands[i], aspect) > handSize(hands[best], aspect)) best = i;
  return { vec: normalizeHand(hands[best], labels[best] === MIRROR_LABEL, aspect), has: true };
}

export function resample(frames: number[][], n = CLIP_FRAMES): number[][] {
  if (frames.length === 0) return [];
  if (frames.length === 1) return Array.from({ length: n }, () => frames[0].slice());
  return Array.from({ length: n }, (_, i) => {
    const pos = (i / (n - 1)) * (frames.length - 1);
    const lo = Math.floor(pos), hi = Math.min(lo + 1, frames.length - 1), t = pos - lo;
    return frames[lo].map((v, k) => v * (1 - t) + frames[hi][k] * t);
  });
}
