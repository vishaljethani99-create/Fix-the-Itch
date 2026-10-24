import type { Landmark } from './types';

export const POINTS = 21;
export const DIM = POINTS * 3;
export const CLIP_FRAMES = 16;
export const CLIP_MS = 1500;

export const MIRROR_LABEL = 'Left';

const MIDDLE_KNUCKLE = 9;

function handSize(h: Landmark[], aspect: number): number {
  if (h.length !== POINTS) return 0;

  const wrist = h[0];
  const knuckle = h[MIDDLE_KNUCKLE];

  return Math.hypot(
    (knuckle.x - wrist.x) * aspect,
    knuckle.y - wrist.y,
    (knuckle.z - wrist.z) * aspect
  );
}

export function normalizeHand(
  h: Landmark[],
  mirror: boolean,
  aspect: number
): number[] {
  if (h.length !== POINTS) {
    throw new Error(`Expected ${POINTS} landmarks, received ${h.length}`);
  }

  const wrist = h[0];
  const size = Math.max(handSize(h, aspect), 1e-6);

  const out: number[] = [];

  for (const p of h) {
    const x = (p.x - wrist.x) * aspect;
    const y = p.y - wrist.y;
    const z = (p.z - wrist.z) * aspect;

    out.push(
      (mirror ? -x : x) / size,
      y / size,
      z / size
    );
  }

  return out;
}

export function normalizeFrame(
  hands: Landmark[][],
  labels: string[],
  aspect: number
): { vec: number[]; has: boolean } {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    aspect = 4 / 3;
  }

  const validHands = hands
    .map((hand, index) => ({
      hand,
      label: labels[index] ?? 'Right',
      size: handSize(hand, aspect)
    }))
    .filter(
      item =>
        item.hand.length === POINTS &&
        Number.isFinite(item.size) &&
        item.size > 1e-6
    );

  if (validHands.length === 0) {
    return {
      vec: new Array(DIM).fill(0),
      has: false
    };
  }

  // Use the largest detected hand.
  const best = validHands.reduce((a, b) =>
    b.size > a.size ? b : a
  );

  return {
    vec: normalizeHand(
      best.hand,
      best.label === MIRROR_LABEL,
      aspect
    ),
    has: true
  };
}

export function resample(
  frames: number[][],
  n = CLIP_FRAMES
): number[][] {
  if (frames.length === 0 || n <= 0) {
    return [];
  }

  const valid = frames.filter(
    frame =>
      frame.length === DIM &&
      frame.every(Number.isFinite)
  );

  if (valid.length === 0) {
    return [];
  }

  if (valid.length === 1) {
    return Array.from(
      { length: n },
      () => valid[0].slice()
    );
  }

  return Array.from({ length: n }, (_, i) => {
    const position =
      (i / (n - 1)) * (valid.length - 1);

    const low = Math.floor(position);
    const high = Math.min(
      low + 1,
      valid.length - 1
    );

    const t = position - low;

    return valid[low].map(
      (value, k) =>
        value * (1 - t) +
        valid[high][k] * t
    );
  });
}
