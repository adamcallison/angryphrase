import { intBrand, type Brand } from '../brand';

export type Col = Brand<'Col', number>;

export const Col: { try(n: number): Col | null; of(n: number): Col } = intBrand('Col', 0);
