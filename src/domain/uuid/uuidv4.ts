/**
 * The single owner of the UUID-v4 concept in the domain:
 * this module mints UUID v4 strings and validates them.
 */
import type { Rng } from '../rng/Rng';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV4(s: string): boolean {
  return UUID_V4_PATTERN.test(s);
}

export function uuidv4(rng: Rng): string {
  const hex = Array.from({ length: 16 }, (_, i) => {
    let b = rng.nextInt(256);
    if (i === 6) b = (b & 0x0f) | 0x40;
    if (i === 8) b = (b & 0x3f) | 0x80;
    return b.toString(16).padStart(2, '0');
  }).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
