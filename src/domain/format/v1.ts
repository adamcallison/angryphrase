import type { Puzzle } from '../puzzle/Puzzle';
import { Title } from '../puzzle/Title';
import { Author } from '../puzzle/Author';
import { PuzzleKey } from '../puzzle/PuzzleKey';
import { CompletenessCheck } from '../puzzle/CompletenessCheck';
import { GridSize } from '../grid/GridSize';
import { Row } from '../grid/Row';
import { Col } from '../grid/Col';
import { Grid } from '../grid/Grid';
import { Cell } from '../grid/Cell';
import { CellMarker } from '../grid/CellMarker';
import type { CellMarker as CellMarkerType } from '../grid/CellMarker';
import { WordKey } from '../word/WordKey';
import { WordLength } from '../word/WordLength';
import { Direction } from '../word/Direction';
import type { DerivedWord } from '../word/DerivedWord';
import type { Word } from '../word/Word';
import { WordDerivation } from '../word/WordDerivation';
import { Numbering } from '../word/Numbering';
import { WordMap } from '../word/WordMap';
import { ChainValidation } from '../chain/ChainValidation';
import { Letter } from '../letter/Letter';
import type { DisplacedClue } from '../builder/DisplacedClue';
import { DisplacedClueId } from '../builder/DisplacedClueId';

export type PuzzleFileType = 'incomplete' | 'complete';

export type ParseFailure = {
  message: string;
};

function markerFromJson(
  spaceRight: boolean,
  spaceBottom: boolean,
  hyphenRight: boolean,
  hyphenBottom: boolean,
  r: number,
  c: number,
  failures: ParseFailure[],
): CellMarkerType | null {
  if (spaceRight && hyphenRight) {
    failures.push({ message: `Cell (${r}, ${c}) has conflicting right markers.` });
    return null;
  }
  if (spaceBottom && hyphenBottom) {
    failures.push({ message: `Cell (${r}, ${c}) has conflicting bottom markers.` });
    return null;
  }
  return {
    right: spaceRight ? 'space' : hyphenRight ? 'hyphen' : 'none',
    bottom: spaceBottom ? 'space' : hyphenBottom ? 'hyphen' : 'none',
  };
}

function markerToJson(marker: CellMarkerType): {
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
} {
  return {
    spaceRight: marker.right === 'space',
    spaceBottom: marker.bottom === 'space',
    hyphenRight: marker.right === 'hyphen',
    hyphenBottom: marker.bottom === 'hyphen',
  };
}

type CellJson = {
  black: boolean;
  puzzleLetter: string | null;
  marker: CellMarkerType;
};

type ParsedWord = {
  startRow: number;
  startCol: number;
  direction: Direction;
  length: number;
  clue: string;
  nextWord: { startRow: number; startCol: number; direction: Direction } | null;
};

const TOP_LEVEL_KEYS = new Set<string>([
  'version',
  'type',
  'key',
  'gridSize',
  'title',
  'author',
  'grid',
  'words',
]);
const CELL_KEYS = new Set<string>([
  'black',
  'puzzleLetter',
  'spaceRight',
  'spaceBottom',
  'hyphenRight',
  'hyphenBottom',
]);
const WORD_KEYS = new Set<string>([
  'startRow',
  'startCol',
  'direction',
  'length',
  'clue',
  'nextWord',
]);
const NEXT_WORD_KEYS = new Set<string>(['startRow', 'startCol', 'direction']);
const DISPLACED_CLUE_KEYS = new Set<string>(['id', 'clue', 'direction']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDirection(value: unknown): value is Direction {
  return value === 'across' || value === 'down';
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function validateTopLevelExtras(parsed: Record<string, unknown>, failures: ParseFailure[]): void {
  for (const key of Object.keys(parsed)) {
    if (!TOP_LEVEL_KEYS.has(key) && key !== 'displacedClues') {
      failures.push({ message: `Unknown top-level field "${key}".` });
    }
  }
}

function validateGrid(
  grid: unknown,
  size: number,
  fileType: PuzzleFileType,
  failures: ParseFailure[],
): CellJson[][] | null {
  if (!Array.isArray(grid)) {
    failures.push({ message: 'Grid must be a 2D array.' });
    return null;
  }
  if (grid.length !== size) {
    failures.push({ message: `Grid must have ${size} rows.` });
    return null;
  }

  const result: CellJson[][] = [];
  let hasErrors = false;

  for (let r = 0; r < size; r++) {
    const row = grid[r];
    if (!Array.isArray(row) || row.length !== size) {
      failures.push({ message: `Grid row ${r} must have ${size} columns.` });
      hasErrors = true;
      continue;
    }

    const resultRow: CellJson[] = [];
    for (let c = 0; c < size; c++) {
      const validated = validateCell(row[c], r, c, fileType, failures);
      if (validated === null) {
        hasErrors = true;
      } else {
        resultRow.push(validated);
      }
    }
    result.push(resultRow);
  }

  return hasErrors ? null : result;
}

function validateCell(
  cell: unknown,
  r: number,
  c: number,
  fileType: PuzzleFileType,
  failures: ParseFailure[],
): CellJson | null {
  if (!isPlainObject(cell)) {
    failures.push({ message: `Cell at row ${r}, col ${c} is malformed.` });
    return null;
  }

  for (const key of Object.keys(cell)) {
    if (!CELL_KEYS.has(key)) {
      failures.push({ message: `Cell at row ${r}, col ${c} has unknown field "${key}".` });
      return null;
    }
  }

  if (typeof cell.black !== 'boolean') {
    failures.push({ message: `Cell at row ${r}, col ${c} is malformed.` });
    return null;
  }

  if (!('puzzleLetter' in cell)) {
    failures.push({ message: `Cell at row ${r}, col ${c} is malformed.` });
    return null;
  }

  const letter = cell.puzzleLetter;
  if (letter !== null && (typeof letter !== 'string' || Letter.try(letter) === null)) {
    failures.push({ message: `Cell at row ${r}, col ${c} is malformed.` });
    return null;
  }

  const markerKeys = ['spaceRight', 'spaceBottom', 'hyphenRight', 'hyphenBottom'] as const;
  for (const key of markerKeys) {
    if (key in cell && typeof cell[key] !== 'boolean') {
      failures.push({ message: `Cell at row ${r}, col ${c} is malformed.` });
      return null;
    }
  }

  const marker = markerFromJson(
    !!cell.spaceRight,
    !!cell.spaceBottom,
    !!cell.hyphenRight,
    !!cell.hyphenBottom,
    r,
    c,
    failures,
  );
  if (marker === null) {
    return null;
  }

  if (fileType === 'complete' && cell.black === false && letter === null) {
    failures.push({
      message: `White cell at row ${r}, col ${c} is missing puzzleLetter (complete files require it).`,
    });
    return null;
  }

  return {
    black: cell.black,
    puzzleLetter: letter as string | null,
    marker,
  };
}

function validateWords(
  words: unknown,
  size: number,
  failures: ParseFailure[],
): ParsedWord[] | null {
  if (!Array.isArray(words)) {
    failures.push({ message: 'Words must be an array.' });
    return null;
  }

  const result: ParsedWord[] = [];
  let hasErrors = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let wordError = false;

    if (!isPlainObject(word)) {
      failures.push({ message: `Word ${i}: word is not an object.` });
      hasErrors = true;
      continue;
    }

    for (const key of Object.keys(word)) {
      if (!WORD_KEYS.has(key)) {
        failures.push({ message: `Word ${i} has unknown field "${key}".` });
        wordError = true;
      }
    }

    const startRow = word.startRow;
    const startCol = word.startCol;
    const direction = word.direction;
    const length = word.length;
    const clue = word.clue;
    const nextWord = word.nextWord;

    if (!isIntegerInRange(startRow, 0, size - 1)) {
      failures.push({ message: `Word ${i}: startRow must be an in-bounds integer.` });
      wordError = true;
    }
    if (!isIntegerInRange(startCol, 0, size - 1)) {
      failures.push({ message: `Word ${i}: startCol must be an in-bounds integer.` });
      wordError = true;
    }
    if (!isDirection(direction)) {
      failures.push({ message: `Word ${i}: direction must be 'across' or 'down'.` });
      wordError = true;
    }
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 2) {
      failures.push({ message: `Word ${i}: length must be an integer >= 2.` });
      wordError = true;
    }
    if (typeof clue !== 'string') {
      failures.push({ message: `Word ${i}: clue must be a string.` });
      wordError = true;
    }

    let parsedNextWord: ParsedWord['nextWord'] = null;
    if (nextWord !== null) {
      if (!isPlainObject(nextWord)) {
        failures.push({ message: `Word ${i}: nextWord must be an object or null.` });
        wordError = true;
      } else {
        for (const key of Object.keys(nextWord)) {
          if (!NEXT_WORD_KEYS.has(key)) {
            failures.push({ message: `Word ${i}: nextWord has unknown field "${key}".` });
            wordError = true;
          }
        }

        const nwStartRow = nextWord.startRow;
        const nwStartCol = nextWord.startCol;
        const nwDirection = nextWord.direction;

        if (!isIntegerInRange(nwStartRow, 0, size - 1)) {
          failures.push({ message: `Word ${i}: nextWord startRow must be an in-bounds integer.` });
          wordError = true;
        }
        if (!isIntegerInRange(nwStartCol, 0, size - 1)) {
          failures.push({ message: `Word ${i}: nextWord startCol must be an in-bounds integer.` });
          wordError = true;
        }
        if (!isDirection(nwDirection)) {
          failures.push({ message: `Word ${i}: nextWord direction must be 'across' or 'down'.` });
          wordError = true;
        }

        if (!wordError) {
          parsedNextWord = {
            startRow: nwStartRow as number,
            startCol: nwStartCol as number,
            direction: nwDirection as Direction,
          };
        }
      }
    }

    if (!wordError) {
      result.push({
        startRow: startRow as number,
        startCol: startCol as number,
        direction: direction as Direction,
        length: length as number,
        clue: clue as string,
        nextWord: parsedNextWord,
      });
    }

    hasErrors = hasErrors || wordError;
  }

  return hasErrors ? null : result;
}

function buildDomainGrid(cells: CellJson[][]): Grid {
  return cells.map((row) =>
    row.map((cd) => {
      if (cd.black) return Cell.black();
      const cell = Cell.white();
      const withLetter =
        cd.puzzleLetter === null ? cell : Cell.setAnswerLetter(cell, Letter.try(cd.puzzleLetter));
      return Cell.setMarker(withLetter, cd.marker);
    }),
  );
}

function buildDomainWords(parsedWords: ParsedWord[]): DerivedWord[] {
  return parsedWords.map((pw) => ({
    key: {
      startRow: Row.of(pw.startRow),
      startCol: Col.of(pw.startCol),
      direction: pw.direction,
    },
    length: WordLength.of(pw.length),
    clue: pw.clue,
    nextWord:
      pw.nextWord === null
        ? null
        : {
            startRow: Row.of(pw.nextWord.startRow),
            startCol: Col.of(pw.nextWord.startCol),
            direction: pw.nextWord.direction,
          },
  }));
}

function crossCheckWords(
  parsedWords: ParsedWord[],
  derivedWords: DerivedWord[],
  failures: ParseFailure[],
): boolean {
  const derivedMap = new Map<string, DerivedWord>();
  for (const w of derivedWords) {
    derivedMap.set(WordKey.toCanonical(w.key), w);
  }

  const listedKeys = new Set<string>();
  let ok = true;

  for (let i = 0; i < parsedWords.length; i++) {
    const pw = parsedWords[i];
    if (pw === undefined) throw new Error('v1.crossCheckWords: parsedWords[i] undefined');
    const key = WordKey.toCanonical({
      startRow: Row.of(pw.startRow),
      startCol: Col.of(pw.startCol),
      direction: pw.direction,
    });
    listedKeys.add(key);

    const derived = derivedMap.get(key);
    if (derived === undefined) {
      failures.push({ message: `Word ${i} does not correspond to a maximal white run in the grid.` });
      ok = false;
    } else if (derived.length !== pw.length) {
      failures.push({ message: `Word ${i}: length does not match grid-derived length.` });
      ok = false;
    }
  }

  for (const w of derivedWords) {
    const key = WordKey.toCanonical(w.key);
    if (!listedKeys.has(key)) {
      failures.push({
        message: `Grid-derived word at ${w.key.startRow},${w.key.startCol},${w.key.direction} is not listed in words.`,
      });
      ok = false;
    }
  }

  return ok;
}

function validateNextWordReferences(words: Word[], failures: ParseFailure[]): boolean {
  const map = WordMap.fromWords(words);
  let ok = true;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === undefined) throw new Error('v1.checkNextWordReferences: words[i] undefined');
    if (w.nextWord !== null && !WordMap.has(map, w.nextWord)) {
      failures.push({ message: `Word ${i} has a dangling nextWord reference.` });
      ok = false;
    }
  }

  return ok;
}

function validateChains(words: Word[], failures: ParseFailure[]): boolean {
  const violations = ChainValidation.validate(words);
  for (const v of violations) {
    switch (v.kind) {
      case 'cycle':
        failures.push({ message: 'Chain validation failed: cycle detected.' });
        break;
      case 'branch':
        failures.push({ message: 'Chain validation failed: branch detected.' });
        break;
      case 'dangling':
        failures.push({ message: 'Chain validation failed: dangling nextWord.' });
        break;
      case 'self-reference':
        failures.push({ message: 'Chain validation failed: self-reference.' });
        break;
    }
  }
  return violations.length === 0;
}

function validateClues(words: Word[], fileType: PuzzleFileType, failures: ParseFailure[]): boolean {
  if (fileType === 'incomplete') {
    return true;
  }

  const violations = CompletenessCheck.clueViolations(words);
  for (const v of violations) {
    switch (v.kind) {
      case 'missing-clue':
        failures.push({
          message: `Word ${Number(v.wordNumber)} ${v.direction} (chain head) is missing a clue.`,
        });
        break;
      case 'non-head-clue':
        failures.push({
          message: `Word ${Number(v.wordNumber)} ${v.direction} is a non-head chain word with a non-empty clue (not allowed in complete files).`,
        });
        break;
    }
  }

  return violations.length === 0;
}

function validateDisplacedClues(
  displacedClues: unknown,
  failures: ParseFailure[],
): { id: DisplacedClueId; clue: string; direction: Direction }[] | null {
  if (!Array.isArray(displacedClues)) {
    failures.push({ message: 'displacedClues is malformed.' });
    return null;
  }

  const result: { id: DisplacedClueId; clue: string; direction: Direction }[] = [];
  const seenIds = new Set<string>();
  let ok = true;

  for (const entry of displacedClues) {
    if (!isPlainObject(entry)) {
      failures.push({ message: 'displacedClues is malformed.' });
      ok = false;
      continue;
    }

    for (const key of Object.keys(entry)) {
      if (!DISPLACED_CLUE_KEYS.has(key)) {
        failures.push({ message: 'displacedClues is malformed.' });
        ok = false;
      }
    }

    const id = entry.id;
    const clue = entry.clue;
    const direction = entry.direction;

    if (typeof id !== 'string' || typeof clue !== 'string' || !isDirection(direction)) {
      failures.push({ message: 'displacedClues is malformed.' });
      ok = false;
      continue;
    }

    const validatedId = DisplacedClueId.try(id);
    if (validatedId === null) {
      failures.push({ message: `displacedClue id is not a valid UUID v4: ${id}.` });
      ok = false;
      continue;
    }

    if (seenIds.has(id)) {
      failures.push({ message: `Duplicate displacedClue id: ${id}.` });
      ok = false;
      continue;
    }
    seenIds.add(id);

    result.push({ id: validatedId, clue, direction });
  }

  return ok ? result : null;
}

function normalizeV1ChainBoundaries(grid: Grid, words: Word[]): Grid {
  const updates: { row: Row; col: Col; cell: Cell }[] = [];

  for (const w of words) {
    if (w.nextWord === null) continue;

    const end = Direction.advance(
      { row: w.key.startRow, col: w.key.startCol },
      w.key.direction,
      Number(w.length) - 1,
    );
    const cell = Grid.cellAt(grid, end.row, end.col);
    if (!Cell.isWhite(cell)) continue;

    const axis = w.key.direction === 'across' ? 'right' : 'bottom';
    if (CellMarker.isEmpty(cell.marker, axis)) {
      const newMarker = CellMarker.write(cell.marker, axis, 'space');
      updates.push({ row: end.row, col: end.col, cell: Cell.setMarker(cell, newMarker) });
    }
  }

  return Grid.updateCells(grid, updates);
}

export const parsePuzzleShape = (
  parsed: unknown,
):
  | { ok: true; puzzle: Puzzle; fileType: PuzzleFileType; displacedClues: DisplacedClue[] }
  | { ok: false; failures: ParseFailure[] } => {
  const failures: ParseFailure[] = [];

  if (!isPlainObject(parsed)) {
    failures.push({ message: 'File is not a valid JSON object.' });
    return { ok: false, failures };
  }

  validateTopLevelExtras(parsed, failures);

  if (parsed.version !== 1 && parsed.version !== 2) {
    failures.push({ message: 'Unknown or missing version.' });
  }

  const fileType = parsed.type;
  if (fileType !== 'incomplete' && fileType !== 'complete') {
    failures.push({ message: 'Unknown or missing file type.' });
  }

  const keyRaw = parsed.key;
  const puzzleKey = typeof keyRaw === 'string' ? PuzzleKey.try(keyRaw) : null;
  if (puzzleKey === null) {
    failures.push({ message: 'Invalid puzzle key (must be a UUID v4).' });
  }

  const gridSizeRaw = parsed.gridSize;
  const gridSize = typeof gridSizeRaw === 'number' ? GridSize.try(gridSizeRaw) : null;
  if (gridSize === null) {
    failures.push({ message: 'Grid size must be an integer between 2 and 25.' });
  }

  const titleRaw = parsed.title;
  const authorRaw = parsed.author;
  if (typeof titleRaw !== 'string' || typeof authorRaw !== 'string') {
    failures.push({ message: 'Title and author must be strings.' });
  }

  if (fileType === 'complete' && 'displacedClues' in parsed) {
    failures.push({ message: 'Complete puzzles must not include displacedClues.' });
  }

  if (failures.length > 0 || (fileType !== 'incomplete' && fileType !== 'complete')) {
    return { ok: false, failures };
  }

  if (gridSize === null || puzzleKey === null) {
    return { ok: false, failures };
  }
  if (typeof titleRaw !== 'string' || typeof authorRaw !== 'string') {
    return { ok: false, failures };
  }

  const cells = validateGrid(parsed.grid, Number(gridSize), fileType, failures);
  const parsedWords = validateWords(parsed.words, Number(gridSize), failures);

  if (cells === null || parsedWords === null) {
    return { ok: false, failures };
  }

  let grid = buildDomainGrid(cells);
  const derivedWords = WordDerivation.derive(grid);

  if (!crossCheckWords(parsedWords, derivedWords, failures)) {
    return { ok: false, failures };
  }

  const domainWordsRaw: DerivedWord[] = buildDomainWords(parsedWords);
  const numberedWords = Numbering.assign(grid, domainWordsRaw);

  validateNextWordReferences(numberedWords, failures);
  validateChains(numberedWords, failures);
  validateClues(numberedWords, fileType, failures);

  const displacedCluesResult =
    fileType === 'incomplete' ? validateDisplacedClues(parsed.displacedClues, failures) : [];

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  if (parsed.version === 1) {
    grid = normalizeV1ChainBoundaries(grid, numberedWords);
  }

  const puzzle: Puzzle = {
    key: puzzleKey,
    gridSize,
    grid,
    words: numberedWords,
    title: Title.of(titleRaw),
    author: Author.of(authorRaw),
  };

  const displacedClues: DisplacedClue[] =
    displacedCluesResult?.map((d) => ({
      id: d.id,
      clue: d.clue,
      direction: d.direction,
    })) ?? [];

  return { ok: true, puzzle, fileType, displacedClues };
};

function buildSerializedOutput(
  p: Puzzle,
  type: PuzzleFileType,
  displacedClues: DisplacedClue[],
) {
  const size = Number(p.gridSize);
  const grid: unknown[][] = p.grid.map((row) =>
    row.map((cell) => ({
      black: cell.black,
      puzzleLetter: cell.black ? null : cell.answerLetter ? String(cell.answerLetter) : null,
      ...markerToJson(cell.marker),
    })),
  );

  const words = p.words.map((w) => ({
    startRow: Number(w.key.startRow),
    startCol: Number(w.key.startCol),
    direction: w.key.direction,
    length: w.length,
    clue: w.clue,
    nextWord:
      w.nextWord === null
        ? null
        : {
            startRow: Number(w.nextWord.startRow),
            startCol: Number(w.nextWord.startCol),
            direction: w.nextWord.direction,
          },
  }));

  return {
    version: 2,
    type,
    key: p.key,
    gridSize: size,
    title: p.title,
    author: p.author,
    grid,
    words,
    displacedClues: displacedClues.map((d) => ({
      id: d.id,
      clue: d.clue,
      direction: d.direction,
    })),
  };
}

export const serializeIncompleteShape = (p: Puzzle, displacedClues: DisplacedClue[]): object => {
  return buildSerializedOutput(p, 'incomplete', displacedClues);
};

export const serializeCompleteShape = (p: Puzzle): object => {
  const {
    version,
    type,
    key,
    gridSize,
    title,
    author,
    grid,
    words,
  } = buildSerializedOutput(p, 'complete', []);
  return { version, type, key, gridSize, title, author, grid, words };
};
