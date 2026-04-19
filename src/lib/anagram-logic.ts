import type { CellData, AnagramState, Word } from "./types";
import { getWordCells } from "./grid-logic";

/**
 * Computes the anagram state for a selected word based on the current grid.
 * Determines which positions are fixed (already have a player letter),
 * and which are empty.
 */
export function computeAnagramState(word: Word, grid: CellData[][]): AnagramState {
  const cells = getWordCells(word);
  const fixedMask: boolean[] = [];
  const fixedLetters: (string | null)[] = [];
  let emptyCount = 0;

  for (const pos of cells) {
    const cell = grid[pos.row][pos.col];
    const isFixed = cell.playerLetter !== null;
    fixedMask.push(isFixed);
    fixedLetters.push(cell.playerLetter);
    if (!isFixed) {
      emptyCount++;
    }
  }

  return {
    word,
    fixedMask,
    fixedLetters,
    length: word.length,
    emptyCount,
  };
}

/**
 * Derives the display letters for the tile row from user input.
 * Fixed positions always show the grid letter.
 * Non-fixed positions show letters from the input text (after claiming fixed letters).
 * If the input text is incomplete, non-fixed positions show null (blank cells).
 */
export function deriveDisplayLetters(
  inputText: string,
  fixedLetters: (string | null)[],
  fixedMask: boolean[],
): (string | null)[] {
  const totalLength = fixedMask.length;
  const result: (string | null)[] = [];

  // If not enough letters typed yet, show fixed letters and null for rest
  if (inputText.length < totalLength) {
    for (let i = 0; i < totalLength; i++) {
      result.push(fixedMask[i] ? fixedLetters[i] : null);
    }
    return result;
  }

  // Claim fixed letters from the input pool
  const pool = inputText.split("");
  for (let i = 0; i < totalLength; i++) {
    if (fixedMask[i]) {
      const fixedLetter = fixedLetters[i]!;
      const idx = pool.indexOf(fixedLetter);
      if (idx !== -1) {
        pool.splice(idx, 1); // Remove one instance
      }
    }
  }

  // Build result: fixed positions get their grid letter,
  // non-fixed positions get letters from the remaining pool
  let poolIdx = 0;
  for (let i = 0; i < totalLength; i++) {
    if (fixedMask[i]) {
      result.push(fixedLetters[i]);
    } else {
      result.push(pool[poolIdx] ?? null);
      poolIdx++;
    }
  }

  return result;
}

/**
 * Validates that the input text is the correct length and contains all
 * fixed letters (as a multiset superset).
 */
export function validateInput(
  inputText: string,
  fixedLetters: (string | null)[],
  fixedMask: boolean[],
): boolean {
  if (inputText.length !== fixedMask.length) return false;

  // Build a frequency map of the input
  const inputFreq = new Map<string, number>();
  for (const ch of inputText) {
    inputFreq.set(ch, (inputFreq.get(ch) ?? 0) + 1);
  }

  // Check that each fixed letter appears at least as many times in the input
  for (let i = 0; i < fixedMask.length; i++) {
    if (fixedMask[i]) {
      const letter = fixedLetters[i]!.toUpperCase();
      const inputCount = inputFreq.get(letter) ?? 0;
      if (inputCount < 1) return false;
      inputFreq.set(letter, inputCount - 1); // "Claim" one instance
    }
  }

  return true;
}

/**
 * Shuffles the non-fixed positions of a display array using Fisher-Yates.
 * Fixed positions are unchanged.
 */
export function shuffleNonFixedLetters(
  display: (string | null)[],
  fixedMask: boolean[],
): (string | null)[] {
  // Extract non-fixed letters
  const nonFixed: string[] = [];
  const nonFixedIndices: number[] = [];
  for (let i = 0; i < display.length; i++) {
    if (!fixedMask[i] && display[i] !== null) {
      nonFixed.push(display[i]!);
      nonFixedIndices.push(i);
    }
  }

  // Fisher-Yates shuffle
  for (let i = nonFixed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nonFixed[i], nonFixed[j]] = [nonFixed[j], nonFixed[i]];
  }

  // Redistribute
  const result = [...display];
  for (let k = 0; k < nonFixedIndices.length; k++) {
    result[nonFixedIndices[k]] = nonFixed[k];
  }
  return result;
}