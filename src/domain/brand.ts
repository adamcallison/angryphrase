export type Brand<Tag extends string, T> = T & { readonly __brand: Tag };
export function brand<Tag extends string, T>(value: T): Brand<Tag, T> {
  return value as Brand<Tag, T>;
}
