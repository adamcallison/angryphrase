import { DisplacedClue } from '../../../src/domain/builder/DisplacedClue';
import type { Rng } from '../../../src/domain/rng/Rng';

describe('DisplacedClue', () => {
  it('DisplacedClue.create(rng, clue, direction) sets all fields and a fresh id', () => {
    let n = 0;
    const rng: Rng = { nextInt: () => n++ };
    const first = DisplacedClue.create(rng, 'A clue', 'across');
    expect(first.clue).toBe('A clue');
    expect(first.direction).toBe('across');
    expect(first.id).toHaveLength(32);

    const second = DisplacedClue.create(rng, 'Another clue', 'down');
    expect(second.id).not.toBe(first.id);
  });

  it('DisplacedClue.create calls DisplacedClueId.generate(rng)', () => {
    let calls = 0;
    const rng: Rng = { nextInt: () => { calls += 1; return 0; } };
    DisplacedClue.create(rng, 'x', 'down');
    expect(calls).toBe(16);
  });

  it('DisplacedClue.withText returns a new DisplacedClue with the replaced clue; original unchanged', () => {
    let n = 0;
    const rng: Rng = { nextInt: () => n++ };
    const original = DisplacedClue.create(rng, 'Original', 'across');
    const updated = DisplacedClue.withText(original, 'Updated');
    expect(updated).not.toBe(original);
    expect(updated.clue).toBe('Updated');
    expect(original.clue).toBe('Original');
  });

  it('DisplacedClue.withText preserves id and direction', () => {
    let n = 0;
    const rng: Rng = { nextInt: () => n++ };
    const original = DisplacedClue.create(rng, 'Original', 'down');
    const updated = DisplacedClue.withText(original, 'Updated');
    expect(updated.id).toBe(original.id);
    expect(updated.direction).toBe(original.direction);
  });

  it('DisplacedClue.create accepts an empty clue', () => {
    const rng: Rng = { nextInt: () => 0 };
    const clue = DisplacedClue.create(rng, '', 'across');
    expect(clue.clue).toBe('');
    expect(clue.direction).toBe('across');
    expect(clue.id).toHaveLength(32);
  });
});
