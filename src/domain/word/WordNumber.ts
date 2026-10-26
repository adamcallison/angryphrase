import { intBrand, type Brand } from '../brand';

export type WordNumber = Brand<'WordNumber', number>;

export const WordNumber: { of(n: number): WordNumber } = { of: intBrand('WordNumber', 1).of };
