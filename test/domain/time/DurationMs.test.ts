import { DurationMs } from '../../../src/domain/time/DurationMs';
import type { DurationMs as DurationMsType } from '../../../src/domain/time/DurationMs';

describe('DurationMs', () => {
  it('DurationMs.DEFAULT is 3500', () => {
    expect(DurationMs.DEFAULT).toBe(3500);
  });

  it('DurationMs brand is not assignable from plain number', () => {
    function _check(d: DurationMsType): DurationMsType {
      return d;
    }

    const x: number = 5;
    // @ts-expect-error DurationMs is not assignable from plain number
    _check(x);
  });
});
