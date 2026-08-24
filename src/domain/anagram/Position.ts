import { brand, type Brand } from '../brand';

export type Position = Brand<'Position', number>;

export const Position: {
  try(n: number): Position | null;
  of(n: number): Position;
  equals(a: Position, b: Position): boolean;
} = {
  try(n: number): Position | null {
    return Number.isInteger(n) && n >= 0 ? brand(n) : null;
  },
  of(n: number): Position {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`Invalid Position: ${n}`);
    }
    return brand(n);
  },
  equals(a: Position, b: Position): boolean {
    return a === b;
  }
};
