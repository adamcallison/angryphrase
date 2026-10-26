import { intBrand, type Brand } from '../brand';

export type EpochMs = Brand<'EpochMs', number>;

export const EpochMs: { of(n: number): EpochMs } = { of: intBrand('EpochMs', 0).of };
