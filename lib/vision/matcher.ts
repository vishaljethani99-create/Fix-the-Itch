import type { SignExample } from './types';
import { CLIP_FRAMES, DIM } from './normalize';

export type Match = { label: string; distance: number; confidence: number };

// Nearest saved example wins; above the threshold -> no result (spec section 5).
export class Matcher {
  examples: SignExample[] = [];
  // threshold: max average distance. ambiguity < 1 additionally rejects a sign whose
  // best distance is not clearly better than the runner-up label (1 = off).
  constructor(public threshold = 0.18, public ambiguity = 1) {}

  setExamples(e: SignExample[]) { this.examples = e.filter((x) => x.frames.length === CLIP_FRAMES && x.frames[0].length === DIM); }

  // average over frames of (euclidean distance / sqrt(63)) = RMS per coordinate
  private dist(a: number[][], b: number[][]): number {
    let total = 0;
    for (let f = 0; f < CLIP_FRAMES; f++) {
      let s = 0;
      for (let k = 0; k < DIM; k++) { const d = a[f][k] - b[f][k]; s += d * d; }
      total += Math.sqrt(s);
    }
    return total / CLIP_FRAMES / Math.sqrt(DIM);
  }

  match(window: number[][]): Match | null {
    if (window.length < CLIP_FRAMES || this.examples.length === 0) return null;
    const best = new Map<string, number>();
    for (const ex of this.examples) {
      const d = this.dist(window, ex.frames);
      if (d < (best.get(ex.label) ?? Infinity)) best.set(ex.label, d);
    }
    const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
    const [label, distance] = ranked[0];
    if (distance > this.threshold) return null;
    if (ranked[1] && distance > ranked[1][1] * this.ambiguity) return null;
    const confidence = Math.max(0, Math.min(1, 1 - distance / (2 * this.threshold)));
    return { label, distance, confidence };
  }
}
