import { describe, expect, it } from 'vitest';
import {
  parsePuzzleV1,
  serializeIncomplete,
  serializeComplete,
  Filename,
} from '../../../src/domain/format/v1';
import { PuzzleKey } from '../../../src/domain/puzzle/PuzzleKey';
import { Puzzle } from '../../../src/domain/puzzle/Puzzle';
import { Title } from '../../../src/domain/puzzle/Title';
import { Author } from '../../../src/domain/puzzle/Author';
import { GridSize } from '../../../src/domain/grid/GridSize';
import { GridOps } from '../../../src/domain/grid/GridOps';
import { Cell } from '../../../src/domain/grid/Cell';
import { Letter } from '../../../src/domain/letter/Letter';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import { WordLength } from '../../../src/domain/word/WordLength';
import type { Word } from '../../../src/domain/word/Word';
import type { Direction } from '../../../src/domain/word/Direction';
import type { DisplacedClue } from '../../../src/domain/builder/DisplacedClue';
import { SeededRng } from '../../fakes/SeededRng';

const VALID_UUID = '00000000-0000-4000-8000-000000000000';
const UUID_A = '01234567-89ab-4def-89ab-0123456789ab';
const UUID_B = '01234567-89ab-4def-89ab-0123456789cd';

function makeKey() {
  return PuzzleKey.generate(new SeededRng(42));
}

type CellJson = {
  black: boolean;
  puzzleLetter: string | null;
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
  [key: string]: unknown;
};

function makeCell(
  black: boolean,
  letter: string | null = null,
  marker: Partial<Omit<CellJson, 'black' | 'puzzleLetter'>> = {},
): CellJson {
  return {
    black,
    puzzleLetter: letter,
    spaceRight: false,
    spaceBottom: false,
    hyphenRight: false,
    hyphenBottom: false,
    ...marker,
  };
}

function makeWord(
  startRow: number,
  startCol: number,
  direction: Direction,
  length: number,
  clue: string,
  nextWord: { startRow: number; startCol: number; direction: Direction } | null = null,
) {
  return {
    startRow,
    startCol,
    direction,
    length,
    number: 1,
    clue,
    nextWord,
  };
}

function makeValidIncomplete() {
  return {
    version: 1,
    type: 'incomplete' as const,
    key: VALID_UUID,
    gridSize: 2,
    title: 'Title',
    author: 'Author',
    grid: [
      [makeCell(false), makeCell(false)],
      [makeCell(true), makeCell(true)],
    ],
    words: [makeWord(0, 0, 'across', 2, '')],
    displacedClues: [] as { id: string; clue: string; direction: Direction }[],
  };
}

function makeValidComplete() {
  return {
    version: 1,
    type: 'complete' as const,
    key: VALID_UUID,
    gridSize: 2,
    title: 'Title',
    author: 'Author',
    grid: [
      [makeCell(false, 'A'), makeCell(false, 'B')],
      [makeCell(true), makeCell(true)],
    ],
    words: [makeWord(0, 0, 'across', 2, 'Head clue')],
  };
}

function setAnswerLetterOrNull(cell: ReturnType<typeof Cell.white>, letter: string | null) {
  return letter === null ? cell : Cell.setAnswerLetter(cell, Letter.try(letter));
}

function buildPuzzle(
  type: 'incomplete' | 'complete',
  letters: [string | null, string | null],
  clue: string,
): Puzzle {
  const size = GridSize.of(2);
  const key = PuzzleKey.try(VALID_UUID)!;
  let p = Puzzle.blank(size, key);
  let grid = p.grid;
  grid = GridOps.setCell(grid, Row.of(0), Col.of(0), setAnswerLetterOrNull(Cell.white(), letters[0]));
  grid = GridOps.setCell(grid, Row.of(0), Col.of(1), setAnswerLetterOrNull(Cell.white(), letters[1]));
  grid = GridOps.setCell(grid, Row.of(1), Col.of(0), Cell.black());
  grid = GridOps.setCell(grid, Row.of(1), Col.of(1), Cell.black());
  p = Puzzle.withGrid(p, grid);
  const word: Word = {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    number: WordNumber.of(1),
    length: WordLength.of(2),
    clue,
    nextWord: null,
  };
  p = Puzzle.withWords(p, [word]);
  p = Puzzle.withMetadata(p, Title.try('Title'), Author.try('Author'));
  return p;
}

describe('parsePuzzleV1', () => {
  it('parses a minimal valid incomplete file with ok: true', () => {
    const input = JSON.stringify(makeValidIncomplete());
    const result = parsePuzzleV1(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileType).toBe('incomplete');
    expect(result.puzzle.key).toBe(PuzzleKey.try(VALID_UUID));
    expect(result.puzzle.gridSize).toBe(GridSize.of(2));
    expect(result.displacedClues).toEqual([]);
  });

  it('parses a minimal valid complete file with ok: true and empty displacedClues', () => {
    const input = JSON.stringify(makeValidComplete());
    const result = parsePuzzleV1(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileType).toBe('complete');
    expect(result.displacedClues).toEqual([]);
    expect(result.puzzle.words).toHaveLength(1);
    expect(result.puzzle.words[0]!.clue).toBe('Head clue');
  });

  it('rejects version != 1', () => {
    const data = makeValidIncomplete();
    data.version = 2;
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain('Unknown or missing version.');
  });

  it('rejects unknown type', () => {
    const data = makeValidIncomplete();
    (data as { type: string }).type = 'legacy';
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain('Unknown or missing file type.');
  });

  it('rejects invalid (non-UUID) key', () => {
    const data = makeValidIncomplete();
    data.key = 'not-a-uuid';
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain('Invalid puzzle key (must be a UUID v4).');
  });

  it('rejects gridSize out of range', () => {
    const data = makeValidIncomplete();
    data.gridSize = 26;
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Grid size must be an integer between 2 and 25.',
    );
  });

  it('rejects malformed JSON', () => {
    const result = parsePuzzleV1('{not json');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain('File is not valid JSON.');
  });

  it('rejects grid with wrong row count', () => {
    const data = makeValidIncomplete();
    data.grid = [data.grid[0]!];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
  });

  it('rejects grid with wrong column count in a row', () => {
    const data = makeValidIncomplete();
    data.grid = [[data.grid[0]![0]!], [data.grid[1]![0]!]];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
  });

  it('rejects a cell with unknown field "letter" (strict)', () => {
    const data = makeValidIncomplete();
    data.grid[0]![0] = { ...data.grid[0]![0]!, letter: 'A' };
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Cell at row 0, col 0 has unknown field "letter".',
    );
  });

  it('rejects a cell with unknown extra field (strict)', () => {
    const data = makeValidIncomplete();
    data.grid[0]![0] = { ...data.grid[0]![0]!, extra: true };
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Cell at row 0, col 0 has unknown field "extra".',
    );
  });

  it('rejects complete file with null puzzleLetter on a white cell', () => {
    const data = makeValidComplete();
    data.grid[0]![0] = makeCell(false, null);
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'White cell at row 0, col 0 is missing puzzleLetter (complete files require it).',
    );
  });

  it('rejects complete file with a non-empty clue on a non-head chain word (C5)', () => {
    const data = makeValidComplete();
    data.gridSize = 5;
    data.grid = [
      [makeCell(false, 'A'), makeCell(false, 'B'), makeCell(true), makeCell(false, 'C'), makeCell(false, 'D')],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
    ];
    data.words = [
      makeWord(0, 0, 'across', 2, 'Head clue', { startRow: 0, startCol: 3, direction: 'across' }),
      makeWord(0, 3, 'across', 2, 'Bad clue'),
    ];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Word 2 across is a non-head chain word with a non-empty clue (not allowed in complete files).',
    );
  });

  it('rejects complete file with empty clue on a chain head', () => {
    const data = makeValidComplete();
    data.words[0] = { ...data.words[0]!, clue: '   ' };
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Word 1 across (chain head) is missing a clue.',
    );
  });

  it('incomplete file accepts empty clues on heads and non-heads', () => {
    const data = makeValidIncomplete();
    data.gridSize = 5;
    data.grid = [
      [makeCell(false), makeCell(false), makeCell(true), makeCell(false), makeCell(false)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
    ];
    data.words = [
      makeWord(0, 0, 'across', 2, '', { startRow: 0, startCol: 3, direction: 'across' }),
      makeWord(0, 3, 'across', 2, 'non-head clue'),
    ];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(true);
  });

  it('rejects word with unknown field (strict)', () => {
    const data = makeValidIncomplete();
    (data.words[0] as { unknown?: boolean }).unknown = true;
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Word 0 has unknown field "unknown".',
    );
  });

  it('rejects word with length < 2', () => {
    const data = makeValidIncomplete();
    data.words[0] = { ...data.words[0]!, length: 1 };
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures[0]!.message).toMatch(/Word 0:/);
  });

  it('rejects word with dangling nextWord reference', () => {
    const data = makeValidIncomplete();
    data.words[0] = { ...data.words[0]!, nextWord: { startRow: 1, startCol: 0, direction: 'across' } };
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Word 0 has a dangling nextWord reference.',
    );
  });

  it('rejects word list whose start positions do not match grid-derived words', () => {
    const data = makeValidIncomplete();
    data.words[0] = makeWord(1, 0, 'across', 2, '');
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Word 0 does not correspond to a maximal white run in the grid.',
    );
  });

  it('rejects word whose length differs from the grid-derived length', () => {
    const data = makeValidIncomplete();
    data.words[0] = { ...data.words[0]!, length: 99 };
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures[0]!.message).toMatch(/length/);
  });

  it('overwrites listed word.number with the re-derived number (FR-98a) — assert via parse then serialize back', () => {
    const data = makeValidIncomplete();
    data.words[0] = { ...data.words[0]!, number: 42 };
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = serializeIncomplete(result.puzzle, result.displacedClues);
    const reparsed = parsePuzzleV1(serialized);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.puzzle.words[0]!.number).toBe(WordNumber.of(1));
  });

  it('rejects cycle in nextWord links (ChainValidation)', () => {
    const data = makeValidIncomplete();
    data.gridSize = 5;
    data.grid = [
      [makeCell(false), makeCell(false), makeCell(true), makeCell(false), makeCell(false)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
    ];
    data.words = [
      makeWord(0, 0, 'across', 2, '', { startRow: 0, startCol: 3, direction: 'across' }),
      makeWord(0, 3, 'across', 2, '', { startRow: 0, startCol: 0, direction: 'across' }),
    ];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain('Chain validation failed: cycle detected.');
  });

  it('rejects branch in nextWord links', () => {
    const data = makeValidIncomplete();
    data.gridSize = 5;
    data.grid = [
      [makeCell(false), makeCell(false), makeCell(true), makeCell(false), makeCell(false)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(false), makeCell(false), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
      [makeCell(true), makeCell(true), makeCell(true), makeCell(true), makeCell(true)],
    ];
    data.words = [
      makeWord(0, 0, 'across', 2, '', { startRow: 0, startCol: 3, direction: 'across' }),
      makeWord(0, 3, 'across', 2, '', null),
      makeWord(2, 0, 'across', 2, '', { startRow: 0, startCol: 3, direction: 'across' }),
    ];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain('Chain validation failed: branch detected.');
  });

  it('rejects displacedClues with duplicate id', () => {
    const data = makeValidIncomplete();
    data.displacedClues = [
      { id: UUID_A, clue: 'First', direction: 'across' },
      { id: UUID_A, clue: 'Second', direction: 'down' },
    ];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      `Duplicate displacedClue id: ${UUID_A}.`,
    );
  });

  it('rejects displacedClues with malformed entry (missing direction)', () => {
    const data = makeValidIncomplete();
    data.displacedClues = [{ id: UUID_A, clue: 'Clue' }] as typeof data.displacedClues;
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain('displacedClues is malformed.');
  });

  it('rejects displacedClues with a non-UUID id', () => {
    const data = makeValidIncomplete();
    data.displacedClues = [{ id: 'not-a-uuid', clue: 'Clue', direction: 'across' }];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'displacedClue id is not a valid UUID v4: not-a-uuid.',
    );
  });

  it('rejects displacedClues with an id that is raw 32-hex (legacy non-UUID format)', () => {
    const data = makeValidIncomplete();
    data.displacedClues = [{ id: 'ab'.repeat(16), clue: 'Clue', direction: 'across' }];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      `displacedClue id is not a valid UUID v4: ${'ab'.repeat(16)}.`,
    );
  });

  it('rejects complete file that includes displacedClues', () => {
    const data = makeValidComplete() as Record<string, unknown>;
    data.displacedClues = [{ id: UUID_A, clue: 'Clue', direction: 'across' }];
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Complete puzzles must not include displacedClues.',
    );
  });

  it('rejects top-level extra field (strict)', () => {
    const data = makeValidIncomplete() as Record<string, unknown>;
    data.extra = 'surprise';
    const result = parsePuzzleV1(JSON.stringify(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.message)).toContain(
      'Unknown top-level field "extra".',
    );
  });
});

describe('serializeIncomplete', () => {
  it('serializeIncomplete produces exactly the field set specified in §6.1', () => {
    const p = buildPuzzle('incomplete', [null, null], '');
    const displaced = [{ id: UUID_A, clue: 'Displaced clue', direction: 'across' as Direction }] as DisplacedClue[];
    const json = serializeIncomplete(p, displaced);
    const result = parsePuzzleV1(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileType).toBe('incomplete');
    expect(result.displacedClues).toHaveLength(1);
    expect(result.displacedClues[0]!.clue).toBe('Displaced clue');
  });

  it('round-trip: serializeIncomplete then parsePuzzleV1 returns the same Puzzle key, gridSize, and displacedClue texts', () => {
    const key = makeKey();
    const size = GridSize.of(2);
    let p = Puzzle.blank(size, key);
    let grid = p.grid;
    grid = GridOps.setCell(grid, Row.of(0), Col.of(0), Cell.white());
    grid = GridOps.setCell(grid, Row.of(0), Col.of(1), Cell.setAnswerLetter(Cell.white(), Letter.try('A')));
    grid = GridOps.setCell(grid, Row.of(1), Col.of(0), Cell.black());
    grid = GridOps.setCell(grid, Row.of(1), Col.of(1), Cell.black());
    p = Puzzle.withGrid(p, grid);
    const word: Word = {
      key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
      number: WordNumber.of(1),
      length: WordLength.of(2),
      clue: '',
      nextWord: null,
    };
    p = Puzzle.withWords(p, [word]);
    p = Puzzle.withMetadata(p, Title.try('My Title'), Author.try('My Author'));

    const displaced = [
      { id: UUID_A, clue: 'First displaced', direction: 'across' as Direction },
      { id: UUID_B, clue: 'Second displaced', direction: 'down' as Direction },
    ] as DisplacedClue[];
    const json = serializeIncomplete(p, displaced);
    const result = parsePuzzleV1(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.key).toBe(key);
    expect(result.puzzle.gridSize).toBe(size);
    expect(result.displacedClues.map((d) => d.clue)).toEqual(['First displaced', 'Second displaced']);
  });
});

describe('serializeComplete', () => {
  it('serializeComplete produces exactly the field set specified in §6.2 (no displacedClues)', () => {
    const p = buildPuzzle('complete', ['A', 'B'], 'Head clue');
    const json = serializeComplete(p);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe('complete');
    expect(parsed).not.toHaveProperty('displacedClues');
    const result = parsePuzzleV1(json);
    expect(result.ok).toBe(true);
  });

  it('round-trip: serializeComplete then parsePuzzleV1 returns the same Puzzle key, grid letters, and clues', () => {
    const p = buildPuzzle('complete', ['C', 'D'], 'Round clue');
    const json = serializeComplete(p);
    const result = parsePuzzleV1(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.key).toBe(PuzzleKey.try(VALID_UUID));
    expect(GridOps.cellAt(result.puzzle.grid, Row.of(0), Col.of(0)).answerLetter).toBe(Letter.try('C'));
    expect(GridOps.cellAt(result.puzzle.grid, Row.of(0), Col.of(1)).answerLetter).toBe(Letter.try('D'));
    expect(result.puzzle.words[0]!.clue).toBe('Round clue');
  });
});

describe('Filename', () => {
  it('Filename.incomplete(key) returns puzzle-<first8>-incomplete.json', () => {
    const key = PuzzleKey.try('12345678-1234-4123-8123-123456789abc')!;
    expect(Filename.incomplete(key)).toBe('puzzle-12345678-incomplete.json');
  });

  it('Filename.complete(key) returns puzzle-<first8>-complete.json', () => {
    const key = PuzzleKey.try('abcdef01-2345-4567-89ab-cdef01234567')!;
    expect(Filename.complete(key)).toBe('puzzle-abcdef01-complete.json');
  });
});
