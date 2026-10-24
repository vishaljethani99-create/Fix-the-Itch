import type { SignPack } from './types';
import { CLIP_FRAMES, DIM } from './normalize';

/** Validate an untrusted sign pack. Throws an Error with a readable message if the shape is wrong. */
export function parseSignPack(value: unknown): SignPack {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Sign pack must be a JSON object.');
  }
  const p = value as Record<string, unknown>;
  if (p.version !== 1) {
    throw new Error(
      'Unsupported sign pack: expected {"version":1,"name":...,"examples":[...]}. ' +
        'Packs in the old {maxDistance,signs,templates} format must be re-recorded.'
    );
  }
  if (typeof p.name !== 'string') throw new Error('Sign pack is missing a "name".');
  if (!Array.isArray(p.examples)) throw new Error('Sign pack is missing an "examples" array.');

  const examples = p.examples.map((ex, i) => {
    if (typeof ex !== 'object' || ex === null) throw new Error(`Example ${i} is not an object.`);
    const { label, frames } = ex as Record<string, unknown>;
    if (typeof label !== 'string' || !label.trim()) throw new Error(`Example ${i} has no label.`);
    if (!Array.isArray(frames) || frames.length !== CLIP_FRAMES) {
      throw new Error(`Example ${i} ("${label}") must have exactly ${CLIP_FRAMES} frames.`);
    }
    for (const f of frames) {
      if (!Array.isArray(f) || f.length !== DIM || !f.every((n) => typeof n === 'number' && Number.isFinite(n))) {
        throw new Error(`Example ${i} ("${label}") has a frame that is not ${DIM} finite numbers.`);
      }
    }
    return { label: label.trim(), frames: frames as number[][] };
  });
  return { version: 1, name: p.name, examples };
}
