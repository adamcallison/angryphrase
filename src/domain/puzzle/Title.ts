import { brand, type Brand } from '../brand';

export type Title = Brand<'Title', string>;

export const Title: { of(s: string): Title } = {
  of(s: string): Title {
    return brand<'Title', string>(s);
  },
};
