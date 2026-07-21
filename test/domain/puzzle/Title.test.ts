import { Title } from '../../../src/domain/puzzle/Title';

describe('Title', () => {
  it('Title.try wraps any string, including empty', () => {
    expect(Title.try('foo')).toBe('foo');
    expect(Title.try('')).toBe('');
  });
});
