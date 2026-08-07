import { describe, it, expect } from 'vitest';
import { deriveCluePanelVM } from '../../../../src/ui/bindings/viewmodels/cluePanelVM';
import { GridOps } from '../../../../src/domain/grid/GridOps';
import { GridSize } from '../../../../src/domain/grid/GridSize';
import { Row } from '../../../../src/domain/grid/Row';
import { Col } from '../../../../src/domain/grid/Col';
import { WordNumber } from '../../../../src/domain/word/WordNumber';
import { WordKey } from '../../../../src/domain/word/WordKey';
import type { Word } from '../../../../src/domain/word/Word';
import type { BuilderSubMode } from '../../../../src/builder/state/state';
import type { DisplacedClueId } from '../../../../src/domain/builder/DisplacedClueId';
import { LengthPattern } from '../../../../src/domain/chain/LengthPattern';
import { WordMap } from '../../../../src/domain/word/WordMap';

function blankGrid() {
  return GridOps.blank(GridSize.of(3));
}

function across1(): Word {
  return {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'across' },
    number: WordNumber.of(1),
    length: 2,
    clue: 'Across one clue',
    nextWord: null,
  };
}

function across2(): Word {
  return {
    key: { startRow: Row.of(2), startCol: Col.of(0), direction: 'across' },
    number: WordNumber.of(3),
    length: 2,
    clue: 'Across two clue',
    nextWord: null,
  };
}

function down1(): Word {
  return {
    key: { startRow: Row.of(0), startCol: Col.of(0), direction: 'down' },
    number: WordNumber.of(1),
    length: 2,
    clue: 'Down one clue',
    nextWord: null,
  };
}

function findEntry(vm: ReturnType<typeof deriveCluePanelVM>, key: WordKey) {
  return [...vm.across, ...vm.down].find((e) => WordKey.equals(e.wordKey, key));
}

describe('deriveCluePanelVM', () => {
  it('deriveCluePanelVM: across list sorted by WordNumber ascending', () => {
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words: [across1(), across2()],
      highlightedWordKey: null,
      isBuilder: false,
    });
    expect(vm.across).toHaveLength(2);
    expect(vm.across[0]!.number).toBe(WordNumber.of(1));
    expect(vm.across[1]!.number).toBe(WordNumber.of(3));
  });

  it('deriveCluePanelVM: down list sorted by WordNumber ascending', () => {
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words: [down1()],
      highlightedWordKey: null,
      isBuilder: false,
    });
    expect(vm.down).toHaveLength(1);
    expect(vm.down[0]!.number).toBe(WordNumber.of(1));
  });

  it('deriveCluePanelVM: head word has displayClue = w.clue, lengthPattern = LengthPattern.forWord', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const words = [head, down1()];
    const vm = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: null, isBuilder: false });
    const entry = findEntry(vm, head.key)!;
    expect(entry.displayClue).toBe(head.clue);
    expect(entry.lengthPattern).toBe(LengthPattern.forWord(blankGrid(), WordMap.fromWords(words), head));
  });

  it('deriveCluePanelVM: non-head word has displayClue = "See N Direction", lengthPattern = null', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const tail = down1();
    const words = [head, tail];
    const vm = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: null, isBuilder: false });
    const entry = findEntry(vm, tail.key)!;
    expect(entry.displayClue).toBe('See 1 Across');
    expect(entry.lengthPattern).toBeNull();
  });

  it('deriveCluePanelVM: isChainHead true for head, false for non-head', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const tail = down1();
    const words = [head, tail];
    const vm = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: null, isBuilder: false });
    expect(findEntry(vm, head.key)!.isChainHead).toBe(true);
    expect(findEntry(vm, tail.key)!.isChainHead).toBe(false);
  });

  it('deriveCluePanelVM: hasOutgoingNextWord reflects w.nextWord !== null', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const tail = down1();
    const words = [head, tail];
    const vm = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: null, isBuilder: false });
    expect(findEntry(vm, head.key)!.hasOutgoingNextWord).toBe(true);
    expect(findEntry(vm, tail.key)!.hasOutgoingNextWord).toBe(false);
  });

  it('deriveCluePanelVM: isSelected true only on the word whose key matches highlightedWordKey; false when highlightedWordKey null', () => {
    const words = [across1(), across2(), down1()];
    const vmNull = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: null, isBuilder: false });
    for (const entry of [...vmNull.across, ...vmNull.down]) {
      expect(entry.isSelected).toBe(false);
    }

    const target = across2().key;
    const vm = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: target, isBuilder: false });
    expect(findEntry(vm, target)!.isSelected).toBe(true);
    for (const entry of [...vm.across, ...vm.down]) {
      if (!WordKey.equals(entry.wordKey, target)) {
        expect(entry.isSelected).toBe(false);
      }
    }
  });

  it('deriveCluePanelVM: isSelected true on all chain members when highlightedWordKey is a non-head tail', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const tail = down1();
    const unrelated = across2();
    const words = [head, tail, unrelated];
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words,
      highlightedWordKey: tail.key,
      isBuilder: false,
    });
    expect(findEntry(vm, head.key)!.isSelected).toBe(true);
    expect(findEntry(vm, tail.key)!.isSelected).toBe(true);
    expect(findEntry(vm, unrelated.key)!.isSelected).toBe(false);
  });

  it('deriveCluePanelVM: isSelected true on all chain members when highlightedWordKey is the head', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const tail = down1();
    const unrelated = across2();
    const words = [head, tail, unrelated];
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words,
      highlightedWordKey: head.key,
      isBuilder: false,
    });
    expect(findEntry(vm, head.key)!.isSelected).toBe(true);
    expect(findEntry(vm, tail.key)!.isSelected).toBe(true);
    expect(findEntry(vm, unrelated.key)!.isSelected).toBe(false);
  });

  it('deriveCluePanelVM (isBuilder=false): all builder-only affordances are false (isStartableJoinSource, isLinkableFromJoinSource, isUnjoinable)', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const words = [head, down1(), across2()];
    const vm = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: null, isBuilder: false });
    for (const entry of [...vm.across, ...vm.down]) {
      expect(entry.isStartableJoinSource).toBe(false);
      expect(entry.isLinkableFromJoinSource).toBe(false);
      expect(entry.isUnjoinable).toBe(false);
    }
  });

  it('deriveCluePanelVM (isBuilder=true, subMode=none): isUnjoinable true when nextWord != null; isStartableJoinSource true when nextWord == null; isLinkableFromJoinSource always false', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const tail = down1();
    const loose = across2();
    const words = [head, tail, loose];
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words,
      highlightedWordKey: null,
      isBuilder: true,
      builderSubMode: { kind: 'none' },
    });
    const headEntry = findEntry(vm, head.key)!;
    expect(headEntry.isUnjoinable).toBe(true);
    expect(headEntry.isStartableJoinSource).toBe(false);
    expect(headEntry.isLinkableFromJoinSource).toBe(false);

    const tailEntry = findEntry(vm, tail.key)!;
    expect(tailEntry.isUnjoinable).toBe(false);
    expect(tailEntry.isStartableJoinSource).toBe(true);
    expect(tailEntry.isLinkableFromJoinSource).toBe(false);

    const looseEntry = findEntry(vm, loose.key)!;
    expect(looseEntry.isUnjoinable).toBe(false);
    expect(looseEntry.isStartableJoinSource).toBe(true);
    expect(looseEntry.isLinkableFromJoinSource).toBe(false);
  });

  it('deriveCluePanelVM (isBuilder=true, subMode=join source A): candidate target ≠ A and not pointed-at → isLinkableFromJoinSource true', () => {
    const words = [across1(), across2(), down1()];
    const source = across1().key;
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words,
      highlightedWordKey: null,
      isBuilder: true,
      builderSubMode: { kind: 'join', source },
    });
    const target = findEntry(vm, across2().key)!;
    expect(target.isLinkableFromJoinSource).toBe(true);
  });

  it('deriveCluePanelVM (isBuilder=true, subMode=join source A): candidate target == A → isLinkableFromJoinSource false (cannot be own target)', () => {
    const words = [across1(), across2(), down1()];
    const source = across1().key;
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words,
      highlightedWordKey: null,
      isBuilder: true,
      builderSubMode: { kind: 'join', source },
    });
    const sourceEntry = findEntry(vm, source)!;
    expect(sourceEntry.isLinkableFromJoinSource).toBe(false);
  });

  it('deriveCluePanelVM (isBuilder=true, subMode=join source A): candidate already pointed-at by another word\'s nextWord → isLinkableFromJoinSource false', () => {
    const head: Word = { ...across1(), nextWord: down1().key };
    const pointedAt = down1();
    const source = across2();
    const words = [head, pointedAt, source];
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words,
      highlightedWordKey: null,
      isBuilder: true,
      builderSubMode: { kind: 'join', source: source.key },
    });
    const candidate = findEntry(vm, pointedAt.key)!;
    expect(candidate.isLinkableFromJoinSource).toBe(false);
  });

  it('deriveCluePanelVM (isBuilder=true, subMode=reattach): isLinkableFromJoinSource false for all words (reattach sub-mode not join)', () => {
    const reattachId = 'reattach-1' as unknown as DisplacedClueId;
    const subMode: BuilderSubMode = { kind: 'reattach', displacedClueId: reattachId };
    const words = [across1(), across2(), down1()];
    const vm = deriveCluePanelVM({
      grid: blankGrid(),
      words,
      highlightedWordKey: null,
      isBuilder: true,
      builderSubMode: subMode,
    });
    for (const entry of [...vm.across, ...vm.down]) {
      expect(entry.isLinkableFromJoinSource).toBe(false);
    }
  });

  it('deriveCluePanelVM: highlightedWordKey passed through unchanged (null and a non-null sample)', () => {
    const words = [across1(), across2(), down1()];
    const vmNull = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: null, isBuilder: false });
    expect(vmNull.highlightedWordKey).toBeNull();

    const key = across2().key;
    const vm = deriveCluePanelVM({ grid: blankGrid(), words, highlightedWordKey: key, isBuilder: false });
    expect(vm.highlightedWordKey).toEqual(key);
  });
});
