import { brand, type Brand } from '../brand';

export type Title = Brand<'Title', string>;

export const Title: { try(s: string): Title } = {
  try(s: string): Title {
    return brand<'Title', string>(s);
  },
};
