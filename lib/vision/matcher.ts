import type { SignExample } from './types';

import {
  CLIP_FRAMES,
  DIM
} from './normalize';

export type Match = {
  label: string;
  distance: number;
  confidence: number;
};

export type MatchDebug = {
  best: Match | null;
  bestDistance: number;
  secondDistance: number;
  accepted: boolean;
};

export class Matcher {
  examples: SignExample[] = [];

  constructor(
    public threshold = 0.38,
    public ambiguity = 1
  ) {}

  setExamples(examples: SignExample[]) {
    this.examples = examples.filter(example => {
      if (!example.label?.trim()) return false;

      if (example.frames.length !== CLIP_FRAMES) {
        return false;
      }

      return example.frames.every(
        frame =>
          frame.length === DIM &&
          frame.every(Number.isFinite)
      );
    });
  }

  private dist(
    a: number[][],
    b: number[][]
  ): number {
    if (
      a.length !== CLIP_FRAMES ||
      b.length !== CLIP_FRAMES
    ) {
      return Infinity;
    }

    let best = Infinity;

    // Compare nearby temporal alignments.
    // Do not clamp shifted frames to the clip edges.
    for (let shift = -3; shift <= 3; shift++) {
      let total = 0;
      let count = 0;

      for (let f = 0; f < CLIP_FRAMES; f++) {
        const bf = f + shift;

        if (
          bf < 0 ||
          bf >= CLIP_FRAMES
        ) {
          continue;
        }

        let sum = 0;

        for (let k = 0; k < DIM; k++) {
          const d = a[f][k] - b[bf][k];
          sum += d * d;
        }

        total += Math.sqrt(sum);
        count++;
      }

      if (count === 0) continue;

      const distance =
        total / count / Math.sqrt(DIM);

      if (distance < best) {
        best = distance;
      }
    }

    return best;
  }

  matchDetailed(
    window: number[][]
  ): MatchDebug {
    const invalid: MatchDebug = {
      best: null,
      bestDistance: Infinity,
      secondDistance: Infinity,
      accepted: false
    };

    if (
      window.length !== CLIP_FRAMES ||
      !window.every(
        frame =>
          frame.length === DIM &&
          frame.every(Number.isFinite)
      ) ||
      this.examples.length === 0
    ) {
      return invalid;
    }

    const distances = new Map<string, number>();

    for (const example of this.examples) {
      const distance = this.dist(
        window,
        example.frames
      );

      const previous =
        distances.get(example.label) ?? Infinity;

      if (distance < previous) {
        distances.set(
          example.label,
          distance
        );
      }
    }

    const ranked = [...distances.entries()]
      .sort((a, b) => a[1] - b[1]);

    if (ranked.length === 0) {
      return invalid;
    }

    const [label, distance] = ranked[0];

    const secondDistance =
      ranked[1]?.[1] ?? Infinity;

    const confidence = Math.max(
      0,
      Math.min(
        1,
        1 - distance / (2 * this.threshold)
      )
    );

    const candidate: Match = {
      label,
      distance,
      confidence
    };

    const accepted =
      distance <= this.threshold &&
      (
        !Number.isFinite(secondDistance) ||
        secondDistance === Infinity ||
        (
          this.ambiguity <= 1 ||
          distance <= secondDistance * this.ambiguity
        )
      );

    return {
      best: accepted ? candidate : null,
      bestDistance: distance,
      secondDistance,
      accepted
    };
  }

  match(window: number[][]): Match | null {
    return this.matchDetailed(window).best;
  }
}
