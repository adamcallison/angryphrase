import { intBrand, type Brand } from '../brand';

export type Row = Brand<'Row', number>;

export const Row: { try(n: number): Row | null; of(n: number): Row } = intBrand('Row', 0);
