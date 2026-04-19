import { describe, it, expect } from "vitest";
import {
  toWordId,
  getChain,
  getChainHead,
  isChainHead,
  getDisplayClue,
  unjoinWord,
  breakChainAtWord,
  validateChains,
  getWordLengthPattern,
  joinWordsAndDisplace,
} from "./chain-logic";
import { createEmptyGrid } from "./grid-logic";
import type { Word, WordPosition, DisplacedClue } from "./types";

// Helper: create a Word for testing
function makeWord(
  startRow: number,
  startCol: number,
  direction: "across" | "down",
  length: number,
  number: number,
  clue = "",
  nextWord: WordPosition | null = null
): Word {
  return {
    startRow,
    startCol,
    direction,
    length,
    number,
    clue,
    nextWord,
  };
}

// Helper: find a word in the array by its id
function findWord(words: Word[], id: string): Word | undefined {
  return words.find((w) => toWordId(w) === id);
}

// ============================================================
// 1. toWordId
// ============================================================
describe("toWordId", () => {
  it("creates correct ID for across word", () => {
    const pos: WordPosition = { startRow: 2, startCol: 5, direction: "across" };
    expect(toWordId(pos)).toBe("2-5-across");
  });

  it("creates correct ID for down word", () => {
    const pos: WordPosition = { startRow: 0, startCol: 3, direction: "down" };
    expect(toWordId(pos)).toBe("0-3-down");
  });

  it("creates correct ID for word at row 0, col 0", () => {
    const pos: WordPosition = { startRow: 0, startCol: 0, direction: "across" };
    expect(toWordId(pos)).toBe("0-0-across");
  });
});

// ============================================================
// 2. getChain
// ============================================================
describe("getChain", () => {
  it("single word (no chain) returns array with just that word", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const words = [wordA];
    const chain = getChain(words, wordA);
    expect(chain).toHaveLength(1);
    expect(chain[0]).toEqual(wordA);
  });

  it("two-word chain A→B returns [A, B]", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];
    const chain = getChain(words, wordA);
    expect(chain).toHaveLength(2);
    expect(toWordId(chain[0])).toBe(toWordId(wordA));
    expect(toWordId(chain[1])).toBe(toWordId(wordB));
  });

  it("three-word chain A→B→C returns [A, B, C]", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "See 1 Across");
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];
    const chain = getChain(words, wordA);
    expect(chain).toHaveLength(3);
    expect(toWordId(chain[0])).toBe(toWordId(wordA));
    expect(toWordId(chain[1])).toBe(toWordId(wordB));
    expect(toWordId(chain[2])).toBe(toWordId(wordC));
  });

  it("word not in chain returns just that word", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const words = [wordA, wordB];
    const chain = getChain(words, wordB);
    expect(chain).toHaveLength(1);
    expect(toWordId(chain[0])).toBe(toWordId(wordB));
  });

  it("starting from middle word of chain returns chain from that word onward", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "");
    const wordB = makeWord(0, 3, "down", 4, 2, "", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];
    // Starting from B, we get B→C
    const chain = getChain(words, wordB);
    expect(chain).toHaveLength(2);
    expect(toWordId(chain[0])).toBe(toWordId(wordB));
    expect(toWordId(chain[1])).toBe(toWordId(wordC));
  });
});

// ============================================================
// 3. getChainHead
// ============================================================
describe("getChainHead", () => {
  it("head word returns itself", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const words = [wordA];
    const head = getChainHead(words, wordA);
    expect(toWordId(head)).toBe(toWordId(wordA));
  });

  it("middle word in chain returns the head", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "");
    const wordB = makeWord(0, 3, "down", 4, 2, "", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];
    const head = getChainHead(words, wordB);
    expect(toWordId(head)).toBe(toWordId(wordA));
  });

  it("tail word in chain returns the head", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "");
    const wordB = makeWord(0, 3, "down", 4, 2, "", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];
    const head = getChainHead(words, wordC);
    expect(toWordId(head)).toBe(toWordId(wordA));
  });

  it("word not in any chain returns itself", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const words = [wordA, wordB];
    const head = getChainHead(words, wordB);
    expect(toWordId(head)).toBe(toWordId(wordB));
  });
});

// ============================================================
// 4. isChainHead
// ============================================================
describe("isChainHead", () => {
  it("word with no pointer TO it is a head", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    // A doesn't point to B, so B is a chain head
    const words = [wordA, wordB];
    expect(isChainHead(words, wordA)).toBe(true);
    expect(isChainHead(words, wordB)).toBe(true);
  });

  it("word pointed to by another word is not a head", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];
    // A points to B, so B is not a head
    expect(isChainHead(words, wordA)).toBe(true);
    expect(isChainHead(words, wordB)).toBe(false);
  });
});

// ============================================================
// 5. getDisplayClue
// ============================================================
describe("getDisplayClue", () => {
  it("head word returns its own clue", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue for word A");
    const words = [wordA];
    expect(getDisplayClue(wordA, words)).toBe("Clue for word A");
  });

  it("non-head word returns 'See [number] [Direction]' format", () => {
    const wordB = makeWord(0, 3, "down", 4, 3, "");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];
    // wordB is pointed to by wordA, so it's a non-head
    // wordA is at (0,0) across, so it gets number from assignNumbers
    // wordA.number = 1
    // But the chain head of wordB is wordA, which has number 1
    // So display clue for wordB should be "See 1 Across"
    expect(getDisplayClue(wordB, words)).toBe("See 1 Across");
  });

  it("non-head word in down chain shows direction correctly", () => {
    const wordC = makeWord(1, 0, "across", 5, 4, "");
    const wordB = makeWord(0, 3, "down", 4, 3, "See 3 Down", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "down", 3, 3, "Clue for down word", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];
    // Chain: A→B→C, A is head with number 3, direction "down"
    // Display clue for B should be "See 3 Down"
    expect(getDisplayClue(wordB, words)).toBe("See 3 Down");
    // Display clue for C should also reference the head
    expect(getDisplayClue(wordC, words)).toBe("See 3 Down");
  });

  it("handles number correctly using the head word's number", () => {
    const wordB = makeWord(2, 0, "across", 4, 5, "");
    const wordA = makeWord(0, 0, "across", 3, 1, "First clue", {
      startRow: 2,
      startCol: 0,
      direction: "across",
    });
    const words = [wordA, wordB];
    // wordA has number 1, so wordB should show "See 1 Across"
    expect(getDisplayClue(wordB, words)).toBe("See 1 Across");
  });
});

// ============================================================
// ============================================================
// 7. unjoinWord
// ============================================================
describe("unjoinWord", () => {
  it("unjoin removes the nextWord link", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];

    const result = unjoinWord(words, toWordId(wordA));

    const unlinkedWord = findWord(result, toWordId(wordA));
    expect(unlinkedWord!.nextWord).toBeNull();
  });

  it("the formerly linked word becomes independent with empty clue slot", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];

    const result = unjoinWord(words, toWordId(wordA));

    // B's clue should become empty (per FR-21 and §6.3)
    const formerlyLinkedWord = findWord(result, toWordId(wordB));
    expect(formerlyLinkedWord!.clue).toBe("");
  });

  it("only the direct link is removed (A→B→C, unjoin A leaves B→C intact)", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "See 1 Across");
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];

    // Unjoin A (removes A→B link)
    const result = unjoinWord(words, toWordId(wordA));

    // A should have no nextWord
    const unlinkedA = findWord(result, toWordId(wordA));
    expect(unlinkedA!.nextWord).toBeNull();

    // B should still have its nextWord→C
    const unlinkedB = findWord(result, toWordId(wordB));
    expect(unlinkedB!.nextWord).toEqual({
      startRow: 1,
      startCol: 0,
      direction: "across",
    });

    // B gets empty clue (was "See 1 Across", now independent head)
    expect(unlinkedB!.clue).toBe("");

    // C should be unchanged
    const unlinkedC = findWord(result, toWordId(wordC));
    expect(unlinkedC!.clue).toBe("See 1 Across");
  });

  it("unjoin a word that has no nextWord is a no-op", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const words = [wordA, wordB];

    const result = unjoinWord(words, toWordId(wordA));

    // A and B should remain unchanged
    const resultA = findWord(result, toWordId(wordA));
    const resultB = findWord(result, toWordId(wordB));
    expect(resultA!.nextWord).toBeNull();
    expect(resultA!.clue).toBe("Clue A");
    expect(resultB!.nextWord).toBeNull();
    expect(resultB!.clue).toBe("Clue B");
  });

  it("does not mutate the input array", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];

    unjoinWord(words, toWordId(wordA));

    // Original wordA should still have its nextWord
    expect(wordA.nextWord).toEqual({
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
  });
});

// ============================================================
// 8. breakChainAtWord
// ============================================================
describe("breakChainAtWord", () => {
  it("destroys link from preceding word (removes preceding word's nextWord)", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];

    // Destroy wordB: A→B becomes A (no nextWord)
    const result = breakChainAtWord(words, toWordId(wordB));

    const resultA = findWord(result, toWordId(wordA));
    expect(resultA!.nextWord).toBeNull();
  });

  it("words after destroyed word become independent with empty clue slots", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "See 1 Across");
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];

    // Destroy wordB (the middle word): A→B→C breaks
    // A's nextWord is removed, C's clue becomes empty
    const result = breakChainAtWord(words, toWordId(wordB));

    // A should have no nextWord
    const resultA = findWord(result, toWordId(wordA));
    expect(resultA!.nextWord).toBeNull();

    // C should have empty clue (was "See 1 Across", now independent)
    const resultC = findWord(result, toWordId(wordC));
    expect(resultC!.clue).toBe("");
  });

  it("no effect on words not in a chain", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const words = [wordA, wordB];

    // Destroy wordB when there's no chain
    const result = breakChainAtWord(words, toWordId(wordB));

    const resultA = findWord(result, toWordId(wordA));
    const resultB = findWord(result, toWordId(wordB));
    expect(resultA!.nextWord).toBeNull();
    expect(resultA!.clue).toBe("Clue A");
    expect(resultB!.clue).toBe("Clue B");
  });

  it("destroying the head of a chain removes its nextWord reference from the preceding context", () => {
    // Chain: A→B, destroy A
    // A has no predecessor, but B (the formerly linked word) should get empty clue
    const wordB = makeWord(0, 3, "down", 4, 3, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];

    const result = breakChainAtWord(words, toWordId(wordA));

    // B should have empty clue (was "See 1 Across", now independent)
    const resultB = findWord(result, toWordId(wordB));
    expect(resultB!.clue).toBe("");
  });

  it("does not mutate the input array", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];

    breakChainAtWord(words, toWordId(wordB));

    // Original should still have nextWord
    expect(wordA.nextWord).not.toBeNull();
  });

  it("destroys word in a longer chain: A→B→C→D, destroy B", () => {
    const wordD = makeWord(2, 0, "down", 3, 4, "See 1 Across");
    const wordC = makeWord(1, 5, "across", 4, 3, "See 1 Across", {
      startRow: 2,
      startCol: 0,
      direction: "down",
    });
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across", {
      startRow: 1,
      startCol: 5,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC, wordD];

    // Destroy B: A→B→C→D becomes A, C becomes head, D still follows C
    const result = breakChainAtWord(words, toWordId(wordB));

    // A's nextWord removed
    const resultA = findWord(result, toWordId(wordA));
    expect(resultA!.nextWord).toBeNull();

    // C gets empty clue (was "See 1 Across", now independent head)
    const resultC = findWord(result, toWordId(wordC));
    expect(resultC!.clue).toBe("");

    // D still follows C (C's nextWord is intact)
    expect(resultC!.nextWord).toEqual({
      startRow: 2,
      startCol: 0,
      direction: "down",
    });

    // D's clue remains "See 1 Across" (it's still referenced to the head)
    // Actually, D's display clue should reference C now since the chain
    // after the break starts from C. But the stored clue text is just
    // data — it's "See 1 Across" which referenced the old head.
    // Per §6.3: "words that had 'See' references pointing toward the
    // destroyed chain section get their clue set to empty string"
    // D had a "See" reference, so D's clue should also become empty.
    const resultD = findWord(result, toWordId(wordD));
    expect(resultD!.clue).toBe("");
  });
});

// ============================================================
// 9. validateChains
// ============================================================
describe("validateChains", () => {
  it("valid chains return true", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const wordC = makeWord(1, 0, "across", 5, 3, "Clue C");
    const words = [wordA, wordB, wordC];
    expect(validateChains(words)).toBe(true);
  });

  it("no chains at all returns true", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const words = [wordA, wordB];
    expect(validateChains(words)).toBe(true);
  });

  it("valid chain with links returns true", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];
    expect(validateChains(words)).toBe(true);
  });

  it("detects cycles (A→B→A)", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across", {
      startRow: 0,
      startCol: 0,
      direction: "across", // B points back to A
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down", // A points to B
    });
    const words = [wordA, wordB];
    expect(validateChains(words)).toBe(false);
  });

  it("detects self-reference (A→A)", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 0,
      direction: "across",
    });
    const words = [wordA];
    expect(validateChains(words)).toBe(false);
  });

  it("detects branching (two words pointing to the same target)", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "Clue C");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B", {
      startRow: 1,
      startCol: 0,
      direction: "across", // B points to C
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 1,
      startCol: 0,
      direction: "across", // A also points to C — branching!
    });
    const words = [wordA, wordB, wordC];
    expect(validateChains(words)).toBe(false);
  });

  it("detects dangling reference (nextWord points to non-existent word)", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 5, // No word at (5,5) down
      startCol: 5,
      direction: "down",
    });
    const words = [wordA];
    expect(validateChains(words)).toBe(false);
  });

  it("empty word list returns true", () => {
    expect(validateChains([])).toBe(true);
  });

  it("three-word chain A→B→C is valid", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "See 1 Across");
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];
    expect(validateChains(words)).toBe(true);
  });

  it("detects two separate chains as valid", () => {
    // Chain 1: A→B
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    // Chain 2: C→D
    const wordD = makeWord(2, 3, "down", 3, 5, "See 3 Across");
    const wordC = makeWord(2, 0, "across", 4, 3, "Clue C", {
      startRow: 2,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC, wordD];
    expect(validateChains(words)).toBe(true);
  });
});

// ============================================================
// 10. getWordLengthPattern
// ============================================================
describe("getWordLengthPattern", () => {
  it("returns total length for a single word with no markers", () => {
    const grid = createEmptyGrid(5);
    const word = makeWord(0, 0, "across", 5, 1, "Clue");
    expect(getWordLengthPattern(grid, word, [word])).toBe("5");
  });

  it("returns comma-separated lengths for a two-word chain", () => {
    const grid = createEmptyGrid(5);
    // Chain: wordA (3 letters) → wordB (4 letters)
    const wordB = makeWord(0, 3, "down", 4, 2, "See 1 Across");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB];
    expect(getWordLengthPattern(grid, wordA, words)).toBe("3,4");
  });

  it("returns comma-separated lengths for a three-word chain", () => {
    const grid = createEmptyGrid(5);
    const wordC = makeWord(1, 0, "across", 5, 3, "");
    const wordB = makeWord(0, 3, "down", 4, 2, "", {
      startRow: 1,
      startCol: 0,
      direction: "across",
    });
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];
    expect(getWordLengthPattern(grid, wordA, words)).toBe("3,4,5");
  });

  it("delegates to single-word pattern for non-chain words", () => {
    const grid = createEmptyGrid(5);
    // Word with a space marker
    grid[0][1] = { ...grid[0][1], spaceRight: true };
    const word = makeWord(0, 0, "across", 5, 1, "Clue");
    expect(getWordLengthPattern(grid, word, [word])).toBe("2, 3");
  });

  it("returns single length for non-chain head word with no nextWord", () => {
    const grid = createEmptyGrid(5);
    const word = makeWord(0, 0, "down", 4, 1, "Clue");
    expect(getWordLengthPattern(grid, word, [word])).toBe("4");
  });
});

// ============================================================
// joinWordsAndDisplace
// ============================================================
describe("joinWordsAndDisplace", () => {
  it("joins two words and returns displaced clues unchanged if target has empty clue", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, ""); // empty clue
    const words = [wordA, wordB];

    const result = joinWordsAndDisplace(
      words,
      toWordId(wordA),
      toWordId(wordB),
      [],
    );

    expect(result).not.toBeNull();
    expect(result!.words).toHaveLength(2);
    expect(result!.displacedClues).toHaveLength(0);

    const sourceWord = findWord(result!.words, toWordId(wordA));
    expect(sourceWord!.nextWord).toEqual({
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
  });

  it("joins two words and displaces the target's clue when non-empty", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Target Clue");
    const words = [wordA, wordB];

    const result = joinWordsAndDisplace(
      words,
      toWordId(wordA),
      toWordId(wordB),
      [],
    );

    expect(result).not.toBeNull();
    expect(result!.words).toHaveLength(2);
    expect(result!.displacedClues).toHaveLength(1);
    expect(result!.displacedClues[0].clue).toBe("Target Clue");
    expect(result!.displacedClues[0].direction).toBe("down");
    expect(result!.displacedClues[0].id).toBeTruthy();
  });

  it("preserves existing displaced clues and appends new one", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Target Clue");
    const words = [wordA, wordB];
    const existingDisplacedClues: DisplacedClue[] = [
      { id: "existing-1", clue: "Old Clue", direction: "across" },
    ];

    const result = joinWordsAndDisplace(
      words,
      toWordId(wordA),
      toWordId(wordB),
      existingDisplacedClues,
    );

    expect(result).not.toBeNull();
    expect(result!.displacedClues).toHaveLength(2);
    expect(result!.displacedClues[0].id).toBe("existing-1");
    expect(result!.displacedClues[1].clue).toBe("Target Clue");
  });

  it("does not displace clue when target clue is whitespace-only", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "   "); // whitespace only
    const words = [wordA, wordB];

    const result = joinWordsAndDisplace(
      words,
      toWordId(wordA),
      toWordId(wordB),
      [],
    );

    expect(result).not.toBeNull();
    expect(result!.displacedClues).toHaveLength(0);
  });

  it("returns null when joining a word to itself", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const words = [wordA];

    const result = joinWordsAndDisplace(
      words,
      toWordId(wordA),
      toWordId(wordA),
      [],
    );

    expect(result).toBeNull();
  });

  it("returns null for invalid join (source already has nextWord)", () => {
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const wordC = makeWord(1, 0, "across", 5, 3, "Clue C");
    const words = [wordA, wordB, wordC];

    // A already points to B, trying to join A→C should fail
    const result = joinWordsAndDisplace(
      words,
      toWordId(wordA),
      toWordId(wordC),
      [],
    );

    expect(result).toBeNull();
  });

  it("returns null for invalid source ID", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const words = [wordA];

    const result = joinWordsAndDisplace(
      words,
      "99-99-across",
      toWordId(wordA),
      [],
    );

    expect(result).toBeNull();
  });

  it("returns null for invalid target ID", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const words = [wordA];

    const result = joinWordsAndDisplace(
      words,
      toWordId(wordA),
      "99-99-down",
      [],
    );

    expect(result).toBeNull();
  });

  it("does not mutate the input words array", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Target Clue");
    const words = [wordA, wordB];
    const originalNextWord = wordA.nextWord;

    joinWordsAndDisplace(words, toWordId(wordA), toWordId(wordB), []);

    expect(wordA.nextWord).toBe(originalNextWord);
  });

  it("does not mutate the input displacedClues array", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 3, "down", 4, 2, "Target Clue");
    const words = [wordA, wordB];
    const existingDisplacedClues: DisplacedClue[] = [
      { id: "existing-1", clue: "Old Clue", direction: "across" },
    ];

    joinWordsAndDisplace(
      words,
      toWordId(wordA),
      toWordId(wordB),
      existingDisplacedClues,
    );

    expect(existingDisplacedClues).toHaveLength(1);
    expect(existingDisplacedClues[0].id).toBe("existing-1");
  });

  it("returns null if target is already pointed to by another word", () => {
    const wordC = makeWord(1, 0, "across", 5, 3, "Clue C");
    const wordB = makeWord(0, 3, "down", 4, 2, "Clue B");
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A", {
      startRow: 0,
      startCol: 3,
      direction: "down",
    });
    const words = [wordA, wordB, wordC];

    // A already points to B, trying to join C→B should fail
    const result = joinWordsAndDisplace(
      words,
      toWordId(wordC),
      toWordId(wordB),
      [],
    );

    expect(result).toBeNull();
  });

  it("join works across directions (across→down)", () => {
    const wordA = makeWord(0, 0, "across", 3, 1, "Clue A");
    const wordB = makeWord(0, 0, "down", 4, 1, "Clue B");
    const words = [wordA, wordB];

    const result = joinWordsAndDisplace(
      words,
      toWordId(wordA),
      toWordId(wordB),
      [],
    );

    expect(result).not.toBeNull();
    const sourceWord = findWord(result!.words, toWordId(wordA));
    expect(sourceWord!.nextWord).toEqual({
      startRow: 0,
      startCol: 0,
      direction: "down",
    });
  });
});