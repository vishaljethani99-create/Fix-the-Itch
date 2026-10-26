// lib/vision/types.ts (Member 1 owns) — exactly the Section 15 contract
import type { RecognizedSign } from '../types';

export type Landmark = { x: number; y: number; z: number };
export type SignExample = { label: string; frames: number[][] }; // 16 frames of normalized values
export type SignPack = { version: 1; name: string; examples: SignExample[] };

export interface SignRecognizer {
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  onSign(cb: (sign: RecognizedSign) => void): () => void;
  onLandmarks(cb: (hands: Landmark[][]) => void): () => void;
  loadPack(pack: SignPack): void;
  exportPack(): SignPack;
  startClip(): void;
  stopClip(): { previewUrl: string };
  saveClip(label: string): void;
  discardClip(): void;
}
