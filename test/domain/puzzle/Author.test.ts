import { Author } from '../../../src/domain/puzzle/Author';
import type { Author as AuthorType } from '../../../src/domain/puzzle/Author';

describe('Author', () => {
  it('Author.of wraps any string, including empty', () => {
    expect(Author.of('bar')).toBe('bar');
    expect(Author.of('')).toBe('');
  });

  it('Author brand is not assignable from a plain string', () => {
    function _check(a: AuthorType): AuthorType {
      return a;
    }

    const x: string = 'not an author';
    // @ts-expect-error Author is not assignable from a plain string
    _check(x);
  });
});
