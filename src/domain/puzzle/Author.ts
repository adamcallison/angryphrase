import { brand, type Brand } from '../brand';

export type Author = Brand<'Author', string>;

export const Author: { of(s: string): Author } = {
  of(s: string): Author {
    return brand<'Author', string>(s);
  },
};
