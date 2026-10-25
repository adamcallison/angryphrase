import { brand, type Brand } from '../brand';

export type Position = Brand<'Position', number>;

export const Position: {
  of(n: number): Position;
} = {
  of(n: number): Position {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`Invalid Position: ${n}`);
    }
    return brand(n);
  }
};
