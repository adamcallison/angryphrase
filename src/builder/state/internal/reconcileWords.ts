import type { Grid } from '../../../domain/grid/Grid';
import type { CellMarker } from '../../../domain/grid/CellMarker';
import type { Word } from '../../../domain/word/Word';
import type { DerivedWord } from '../../../domain/word/DerivedWord';
import type { DisplacedClue } from '../../../domain/builder/DisplacedClue';
import type { DomainEvent } from '../../../domain/notifications/Event';
import type { Direction } from '../../../domain/word/Direction';
import type { Rng } from '../../../domain/rng/Rng';
import type { ChainViolation } from '../../../domain/chain/ChainViolation';
import { Row } from '../../../domain/grid/Row';
import { Col } from '../../../domain/grid/Col';
import { WordKey } from '../../../domain/word/WordKey';
import { Numbering } from '../../../domain/word/Numbering';
import { ChainValidation } from '../../../domain/chain/ChainValidation';
import { DisplacedClue as DisplacedClueCtor } from '../../../domain/builder/DisplacedClue';
import { Direction as DirectionOps } from '../../../domain/word/Direction';
import { GridOps } from '../../../domain/grid/GridOps';
import { Cell } from '../../../domain/grid/Cell';

type LengthChange = {
  wordKey: string;
  direction: Direction;
  change: 'shortened' | 'lengthened';
};

export function reconcileWords(
  grid: Grid,
  oldWords: Word[],
  newWords: DerivedWord[],
  oldDisplacedClues: DisplacedClue[],
  rng: Rng,
): { grid: Grid; words: Word[]; displacedClues: DisplacedClue[]; events: DomainEvent[] } {
  const oldByCanonical = new Map<string, Word>();
  for (const word of oldWords) {
    oldByCanonical.set(WordKey.toCanonical(word.key), word);
  }

  const newByCanonical = new Map<string, DerivedWord>();
  for (const word of newWords) {
    newByCanonical.set(WordKey.toCanonical(word.key), word);
  }

  const lengthChanges: LengthChange[] = [];
  const survivingByCanonical = new Map<string, DerivedWord>();

  for (const [canonical, newWord] of newByCanonical) {
    const oldWord = oldByCanonical.get(canonical);
    if (oldWord === undefined) continue;

    if (newWord.length !== oldWord.length) {
      lengthChanges.push({
        wordKey: canonical,
        direction: newWord.key.direction,
        change: newWord.length < oldWord.length ? 'shortened' : 'lengthened',
      });
    }

    survivingByCanonical.set(canonical, {
      key: newWord.key,
      length: newWord.length,
      clue: oldWord.clue,
      nextWord: oldWord.nextWord,
    });
  }

  const destroyedCanonicals = new Set<string>();
  const displacedClues: DisplacedClue[] = [...oldDisplacedClues];

  for (const [canonical, oldWord] of oldByCanonical) {
    if (newByCanonical.has(canonical)) continue;

    destroyedCanonicals.add(canonical);

    if (oldWord.clue.trim() !== '') {
      displacedClues.push(DisplacedClueCtor.create(rng, oldWord.clue, oldWord.key.direction));
    }
  }

  for (const [canonical, survivor] of survivingByCanonical) {
    if (survivor.nextWord !== null && destroyedCanonicals.has(WordKey.toCanonical(survivor.nextWord))) {
      survivingByCanonical.set(canonical, { ...survivor, nextWord: null });
    }
  }

  for (const destroyedCanonical of destroyedCanonicals) {
    const destroyedWord = oldByCanonical.get(destroyedCanonical);
    if (destroyedWord === undefined) continue;

    let currentKey = destroyedWord.nextWord;
    while (currentKey !== null) {
      const currentCanonical = WordKey.toCanonical(currentKey);
      if (destroyedCanonicals.has(currentCanonical)) break;

      const currentSurvivor = survivingByCanonical.get(currentCanonical);
      if (currentSurvivor === undefined) break;

      survivingByCanonical.set(currentCanonical, { ...currentSurvivor, clue: '' });
      currentKey = currentSurvivor.nextWord;
    }
  }

  for (const [canonical, newWord] of newByCanonical) {
    if (oldByCanonical.has(canonical)) continue;
    survivingByCanonical.set(canonical, {
      key: newWord.key,
      length: newWord.length,
      clue: '',
      nextWord: null,
    });
  }

  const derivedWords: DerivedWord[] = [];
  for (const newWord of newWords) {
    const canonical = WordKey.toCanonical(newWord.key);
    const reconciled = survivingByCanonical.get(canonical);
    if (reconciled === undefined) {
      throw new Error(`reconcileWords: unreachable: new word ${canonical} missing from reconciled set`);
    }
    derivedWords.push(reconciled);
  }

  const reconciledGrid = applyBoundaryMarkerRule(grid, oldWords, newByCanonical, survivingByCanonical);

  const words = Numbering.assign(reconciledGrid, derivedWords);
  const wordsByCanonical = new Map<string, Word>();
  for (const word of words) {
    wordsByCanonical.set(WordKey.toCanonical(word.key), word);
  }

  const lengthChangeEvents: DomainEvent[] = [];
  for (const { wordKey, direction, change } of lengthChanges) {
    const numbered = wordsByCanonical.get(wordKey);
    if (numbered === undefined) continue;
    lengthChangeEvents.push({
      kind: 'toast',
      toastKind: 'info',
      message: `Word ${Number(numbered.number)} ${direction} was ${change}.`,
    });
  }

  const violations = ChainValidation.validate(words);
  if (violations.length > 0) {
    throw new Error(
      `reconcileWords: post-reconciliation invariant violated: ${violations.map(describeViolation).join('; ')}`,
    );
  }

  return { grid: reconciledGrid, words, displacedClues, events: lengthChangeEvents };
}

type BoundaryKind = 'space' | 'hyphen' | 'none';

type MarkerPatch = Partial<CellMarker>;

function applyBoundaryMarkerRule(
  grid: Grid,
  oldWords: Word[],
  newByCanonical: Map<string, DerivedWord>,
  survivingByCanonical: Map<string, DerivedWord>,
): Grid {
  const patches = new Map<string, MarkerPatch>();

  function patch(row: Row, col: Col, markerPatch: MarkerPatch): void {
    const key = `${Number(row)},${Number(col)}`;
    const existing = patches.get(key);
    patches.set(key, { ...existing, ...markerPatch });
  }

  for (const oldWord of oldWords) {
    if (oldWord.nextWord === null) continue;

    const oldEnd = DirectionOps.advance(
      { row: oldWord.key.startRow, col: oldWord.key.startCol },
      oldWord.key.direction,
      Number(oldWord.length) - 1,
    );

    if (!GridOps.withinBounds(grid, oldEnd.row, oldEnd.col)) continue;

    const kind = readBoundaryKind(grid, oldEnd.row, oldEnd.col, oldWord.key.direction);
    const canonical = WordKey.toCanonical(oldWord.key);

    if (!newByCanonical.has(canonical)) {
      if (Cell.isWhite(GridOps.cellAt(grid, oldEnd.row, oldEnd.col))) {
        patch(oldEnd.row, oldEnd.col, clearPatch(oldWord.key.direction));
      }
      continue;
    }

    const survivor = survivingByCanonical.get(canonical);
    if (survivor === undefined) continue;

    if (Cell.isWhite(GridOps.cellAt(grid, oldEnd.row, oldEnd.col))) {
      patch(oldEnd.row, oldEnd.col, clearPatch(oldWord.key.direction));
    }

    if (survivor.nextWord !== null) {
      const newEnd = DirectionOps.advance(
        { row: survivor.key.startRow, col: survivor.key.startCol },
        survivor.key.direction,
        Number(survivor.length) - 1,
      );
      if (
        GridOps.withinBounds(grid, newEnd.row, newEnd.col) &&
        Cell.isWhite(GridOps.cellAt(grid, newEnd.row, newEnd.col))
      ) {
        patch(newEnd.row, newEnd.col, setPatch(survivor.key.direction, kind));
      }
    }
  }

  if (patches.size === 0) return grid;

  const updates: { row: Row; col: Col; cell: Cell }[] = [];
  for (const [key, markerPatch] of patches) {
    const [rowStr, colStr] = key.split(',');
    const row = Row.of(Number(rowStr));
    const col = Col.of(Number(colStr));
    const cell = GridOps.cellAt(grid, row, col);
    if (!Cell.isWhite(cell)) continue;
    const nextMarker: CellMarker = { ...cell.marker, ...markerPatch };
    updates.push({ row, col, cell: Cell.setMarker(cell, nextMarker) });
  }

  return GridOps.updateCells(grid, updates);
}

function readBoundaryKind(grid: Grid, row: Row, col: Col, direction: Direction): BoundaryKind {
  const cell = GridOps.cellAt(grid, row, col);
  if (!Cell.isWhite(cell)) return 'space';
  const marker = cell.marker;
  if (direction === 'across') {
    if (marker.spaceRight) return 'space';
    if (marker.hyphenRight) return 'hyphen';
  } else {
    if (marker.spaceBottom) return 'space';
    if (marker.hyphenBottom) return 'hyphen';
  }
  return 'none';
}

function clearPatch(direction: Direction): MarkerPatch {
  return direction === 'across'
    ? { spaceRight: false, hyphenRight: false }
    : { spaceBottom: false, hyphenBottom: false };
}

function setPatch(direction: Direction, kind: BoundaryKind): MarkerPatch {
  if (direction === 'across') {
    return kind === 'space'
      ? { spaceRight: true, hyphenRight: false }
      : kind === 'hyphen'
        ? { spaceRight: false, hyphenRight: true }
        : { spaceRight: false, hyphenRight: false };
  }
  return kind === 'space'
    ? { spaceBottom: true, hyphenBottom: false }
    : kind === 'hyphen'
      ? { spaceBottom: false, hyphenBottom: true }
      : { spaceBottom: false, hyphenBottom: false };
}

function describeViolation(violation: ChainViolation): string {
  switch (violation.kind) {
    case 'cycle':
      return `cycle involving ${violation.involved.map(WordKey.toCanonical).join(', ')}`;
    case 'branch':
      return `branch targeting ${WordKey.toCanonical(violation.target)} from ${violation.sources.map(WordKey.toCanonical).join(', ')}`;
    case 'dangling':
      return `dangling link from ${WordKey.toCanonical(violation.source)} to ${WordKey.toCanonical(violation.missingTarget)}`;
    case 'self-reference':
      return `self-reference at ${WordKey.toCanonical(violation.word)}`;
    default:
      return JSON.stringify(violation);
  }
}
