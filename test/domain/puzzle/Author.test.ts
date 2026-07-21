import { Author } from '../../../src/domain/puzzle/Author';

describe('Author', () => {
  it('Author.try wraps any string, including empty', () => {
    expect(Author.try('bar')).toBe('bar');
    expect(Author.try('')).toBe('');
  });
});
