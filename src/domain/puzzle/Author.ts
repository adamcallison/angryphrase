import { brand, type Brand } from '../brand';

export type Author = Brand<'Author', string>;

export const Author: { try(s: string): Author } = {
  try(s: string): Author {
    return brand<'Author', string>(s);
  },
};
