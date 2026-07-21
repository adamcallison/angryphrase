import { brand, type Brand } from '../brand';

export type Letter = Brand<'Letter', string>;

export const Letter: {
  try(ch: string): Letter | null;
  from(s: string): Letter[];
  equals(a: Letter, b: Letter): boolean;
} = {
  try(ch: string): Letter | null {
    if (ch.length !== 1) return null;
    const upper = ch.toUpperCase();
    if (upper.length !== 1 || upper < 'A' || upper > 'Z') return null;
    return brand<'Letter', string>(upper);
  },

  from(s: string): Letter[] {
    const result: Letter[] = [];
    for (const codePoint of Array.from(s)) {
      const letter = Letter.try(codePoint);
      if (letter !== null) {
        result.push(letter);
      }
    }
    return result;
  },

  equals(a: Letter, b: Letter): boolean {
    return a === b;
  },
};
