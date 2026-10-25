import { brand, type Brand } from '../brand';

export type DurationMs = Brand<'DurationMs', number>;

export const DurationMs: {
  DEFAULT: DurationMs;
} = {
  DEFAULT: brand(3500) as Brand<'DurationMs', 3500>
};
