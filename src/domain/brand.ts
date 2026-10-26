/**
 * The branding primitives: the `Brand<Tag, T>` nominal type, the unsound
 * `brand()` escaper, and `intBrand()` — the checked integer-brand factory.
 *
 * Brand factories follow a two-name constructor convention:
 * - `try` = may return `null`, never throws
 * - `of` = never returns `null`, throws `RangeError` when out of range
 */
export type Brand<Tag extends string, T> = T & { readonly __brand: Tag };
export function brand<Tag extends string, T>(value: T): Brand<Tag, T> {
  return value as Brand<Tag, T>;
}

export function intBrand<Tag extends string>(
  tag: Tag,
  min: number,
  max = Number.POSITIVE_INFINITY,
): {
  try(n: number): Brand<Tag, number> | null;
  of(n: number): Brand<Tag, number>;
} {
  const valid = (n: number) => Number.isInteger(n) && n >= min && n <= max;
  return {
    try: (n: number) => (valid(n) ? brand<Tag, number>(n) : null),
    of: (n: number) => {
      if (!valid(n)) throw new RangeError(`Invalid ${tag}: ${n}`);
      return brand<Tag, number>(n);
    },
  };
}
