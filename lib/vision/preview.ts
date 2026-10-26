import type { Landmark } from './types';

const LINKS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

// Animated SVG of the captured skeleton -> use as <img src={previewUrl}>. Synchronous, no video stored.
export function buildPreviewUrl(frames: Landmark[][][], frameMs = 66): string {
  if (frames.length === 0) return '';
  const W = 320, H = 240, n = frames.length, dur = (n * frameMs) / 1000;
  const groups = frames.map((hands, i) => {
    const a = i / n, b = (i + 1) / n;
    const shapes = hands.map((h) =>
      LINKS.map(([p, q]) => `<line x1="${h[p].x * W}" y1="${h[p].y * H}" x2="${h[q].x * W}" y2="${h[q].y * H}" stroke="#22d3ee" stroke-width="3"/>`).join('') +
      h.map((p) => `<circle cx="${p.x * W}" cy="${p.y * H}" r="3.5" fill="#fff"/>`).join('')).join('');
    return `<g visibility="hidden">${shapes}<animate attributeName="visibility" calcMode="discrete" dur="${dur}s" repeatCount="indefinite" keyTimes="0;${a};${b};1" values="hidden;visible;hidden;hidden"/></g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0f172a"/>${groups}</svg>`;
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}
