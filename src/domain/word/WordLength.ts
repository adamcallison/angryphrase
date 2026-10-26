import { intBrand, type Brand } from '../brand';

export type WordLength = Brand<'WordLength', number>;

export const WordLength: { of(n: number): WordLength } = { of: intBrand('WordLength', 2).of };
