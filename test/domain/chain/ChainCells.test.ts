import { ChainCells } from '../../../src/domain/chain/ChainCells';
import { Row } from '../../../src/domain/grid/Row';
import { Col } from '../../../src/domain/grid/Col';
import { WordNumber } from '../../../src/domain/word/WordNumber';
import type { Word } from '../../../src/domain/word/Word';
import type { WordKey as WordKeyType } from '../../../src/domain/word/WordKey';
import type { Direction } from '../../../src/domain/word/Direction';

function makeWord(
  row: number,
  col: number,
  direction: Direction,
  length: number,
  clue = '',
  next: WordKeyType | null = null,
): Word {
  return {
    key: { startRow: Row.of(row), startCol: Col.of(col), direction },
    number: WordNumber.of(1),
    length,
    clue,
    nextWord: next,
  };
}

describe('ChainCells', () => {
  it('cellsOfWord: across word returns N cells along startRow, startCol..startCol+length-1', () => {
    const word = makeWord(2, 1, 'across', 3);

    expect(ChainCells.cellsOfWord(word)).toEqual(new Set(['2,1', '2,2', '2,3']));
  });

  it('cellsOfWord: down word returns N cells along startCol, startRow..startRow+length-1', () => {
    const word = makeWord(1, 4, 'down', 3);

    expect(ChainCells.cellsOfWord(word)).toEqual(new Set(['1,4', '2,4', '3,4']));
  });

  it('cellsOfWord: direction drives r/c offset (across startRow constant, down startCol constant)', () => {
    const across = makeWord(5, 7, 'across', 3);
    const down = makeWord(5, 7, 'down', 4);

    expect(ChainCells.cellsOfWord(across)).toEqual(new Set(['5,7', '5,8', '5,9']));
    expect(ChainCells.cellsOfWord(down)).toEqual(new Set(['5,7', '6,7', '7,7', '8,7']));
  });

  it('cellsOfChain: null cursorWord returns empty set', () => {
    expect(ChainCells.cellsOfChain([], null)).toEqual(new Set<string>());
  });

  it('cellsOfChain: single word with no chain (nextWord null) returns just that word\'s cells', () => {
    const word = makeWord(0, 0, 'across', 4);

    expect(ChainCells.cellsOfChain([word], word)).toEqual(new Set(['0,0', '0,1', '0,2', '0,3']));
  });

  it('cellsOfChain: two-member chain unions both members\' cells', () => {
    const downKey: WordKeyType = {
      startRow: Row.of(0),
      startCol: Col.of(3),
      direction: 'down',
    };
    const across = makeWord(0, 0, 'across', 4, '', downKey);
    const down = makeWord(0, 3, 'down', 3, '', null);

    expect(ChainCells.cellsOfChain([across, down], across)).toEqual(
      new Set(['0,0', '0,1', '0,2', '0,3', '1,3', '2,3']),
    );
  });

  it('cellsOfChain: cursor on non-head returns whole chain\'s cells', () => {
    const downKey: WordKeyType = {
      startRow: Row.of(0),
      startCol: Col.of(3),
      direction: 'down',
    };
    const across = makeWord(0, 0, 'across', 4, '', downKey);
    const down = makeWord(0, 3, 'down', 3, '', null);

    expect(ChainCells.cellsOfChain([across, down], down)).toEqual(
      new Set(['0,0', '0,1', '0,2', '0,3', '1,3', '2,3']),
    );
  });

  it('cellsOfChain: empty words list returns empty set', () => {
    expect(ChainCells.cellsOfChain([], null)).toEqual(new Set<string>());
  });
});
