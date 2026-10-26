import { Title } from '../../../src/domain/puzzle/Title';
import type { Title as TitleType } from '../../../src/domain/puzzle/Title';

describe('Title', () => {
  it('Title.of wraps any string, including empty', () => {
    expect(Title.of('foo')).toBe('foo');
    expect(Title.of('')).toBe('');
  });

  it('Title brand is not assignable from a plain string', () => {
    function _check(t: TitleType): TitleType {
      return t;
    }

    const x: string = 'not a title';
    // @ts-expect-error Title is not assignable from a plain string
    _check(x);
  });
});
