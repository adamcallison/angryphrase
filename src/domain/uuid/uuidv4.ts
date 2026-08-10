import type { Rng } from '../rng/Rng';

export function uuidv4(rng: Rng): string {
  const hex = Array.from({ length: 16 }, (_, i) => {
    let b = rng.nextInt(256);
    if (i === 6) b = (b & 0x0f) | 0x40;
    if (i === 8) b = (b & 0x3f) | 0x80;
    return b.toString(16).padStart(2, '0');
  }).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
