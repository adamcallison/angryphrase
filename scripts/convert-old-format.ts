/**
 * Converts a puzzle from the old format to our current puzzle JSON format.
 *
 * Old format:
 *   grid.size, grid.whiteCells (array of [row,col]), words[].startCoords/direction/clue/answer/separators
 *   separators: { index, type: "space"|"hyphen" } — index is position *after which* the separator goes
 *   Answers may contain spaces (treated as "space" separators).
 *   Empty answers/clues indicate incomplete word slots.
 *   metadata may include builderState and other extra fields.
 *
 * Output format depends on completeness:
 *   - Complete puzzles → CompletePuzzleJSON (type: "complete")
 *   - Incomplete puzzles → IncompletePuzzleJSON (type: "incomplete", includes displacedClues)
 *
 * A puzzle is considered incomplete if any word has an empty answer.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";

interface OldSeparator {
  index: number;
  type: "space" | "hyphen";
}

interface OldWord {
  startCoords: [number, number];
  direction: "across" | "down";
  clue: string;
  answer: string;
  separators?: OldSeparator[]; // Optional — may be omitted for incomplete words
}

interface OldPuzzle {
  version: string;
  grid: {
    size: number;
    whiteCells: [number, number][];
  };
  words: OldWord[];
  metadata: {
    title: string;
    author: string;
    date: string;
    builderState?: unknown; // Extra field in incomplete puzzles — ignored
  };
}

interface CellData {
  black: boolean;
  letter: string | null;
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
}

interface Word {
  startRow: number;
  startCol: number;
  direction: "across" | "down";
  length: number;
  number: number;
  clue: string;
  nextWord: { startRow: number; startCol: number; direction: "across" | "down" } | null;
}

/** Parse a raw answer string, extracting letters and converting spaces to separator entries. */
function parseAnswer(rawAnswer: string): {
  cleanAnswer: string;
  implicitSeparators: OldSeparator[];
} {
  const implicitSeparators: OldSeparator[] = [];
  let letterCount = 0;
  const cleanChars: string[] = [];

  for (const ch of rawAnswer) {
    if (ch === " ") {
      // Space separator after the previous letter
      implicitSeparators.push({ index: letterCount - 1, type: "space" });
    } else {
      cleanChars.push(ch);
      letterCount++;
    }
  }

  return { cleanAnswer: cleanChars.join(""), implicitSeparators };
}

/** Compute word length from the grid (consecutive white cells from start position). */
function computeWordLength(grid: CellData[][], startRow: number, startCol: number, direction: "across" | "down"): number {
  let length = 0;
  let r = startRow;
  let c = startCol;
  while (r < grid.length && c < grid[0].length && !grid[r][c].black) {
    length++;
    if (direction === "across") {
      c++;
    } else {
      r++;
    }
  }
  return length;
}

function convert(inputPath: string, outputPath: string): void {
  const raw = readFileSync(inputPath, "utf-8");
  const old: OldPuzzle = JSON.parse(raw);
  const size = old.grid.size;

  // Build a set of white cells for quick lookup
  const whiteSet = new Set<string>();
  for (const [r, c] of old.grid.whiteCells) {
    whiteSet.add(`${r}-${c}`);
  }

  // Initialize grid — all cells black by default
  const grid: CellData[][] = [];
  for (let r = 0; r < size; r++) {
    grid[r] = [];
    for (let c = 0; c < size; c++) {
      grid[r][c] = {
        black: !whiteSet.has(`${r}-${c}`),
        letter: null,
        spaceRight: false,
        spaceBottom: false,
        hyphenRight: false,
        hyphenBottom: false,
      };
    }
  }

  // Parse each word: strip spaces from answers, merge explicit + implicit separators
  const parsedWords = old.words.map((w) => {
    const { cleanAnswer, implicitSeparators } = parseAnswer(w.answer);
    const explicitSeparators = w.separators ?? [];
    // Merge and deduplicate separators (implicit from spaces + explicit)
    const allSeparators = [...implicitSeparators, ...explicitSeparators];
    return {
      ...w,
      cleanAnswer,
      allSeparators,
    };
  });

  // Place letters from cleaned answers into the grid
  for (const word of parsedWords) {
    if (word.cleanAnswer.length === 0) continue; // Skip empty answers — length derived from grid
    const [startRow, startCol] = word.startCoords;
    for (let i = 0; i < word.cleanAnswer.length; i++) {
      const row = word.direction === "down" ? startRow + i : startRow;
      const col = word.direction === "across" ? startCol + i : startCol;
      if (row < size && col < size && !grid[row][col].black) {
        grid[row][col].letter = word.cleanAnswer[i];
      }
    }
  }

  // Set separator markers on grid cells
  // Old format separator index = position AFTER which the separator appears
  // e.g. index 2 means after the 3rd letter (0-indexed: after letter at position 2)
  for (const word of parsedWords) {
    const [startRow, startCol] = word.startCoords;
    for (const sep of word.allSeparators) {
      const row = word.direction === "down" ? startRow + sep.index : startRow;
      const col = word.direction === "across" ? startCol + sep.index : startCol;
      if (row < size && col < size && !grid[row][col].black) {
        if (sep.type === "space") {
          if (word.direction === "across") {
            grid[row][col].spaceRight = true;
          } else {
            grid[row][col].spaceBottom = true;
          }
        } else if (sep.type === "hyphen") {
          if (word.direction === "across") {
            grid[row][col].hyphenRight = true;
          } else {
            grid[row][col].hyphenBottom = true;
          }
        }
      }
    }
  }

  // Compute word numbers: standard crossword numbering
  // A cell gets a number if it starts an across word OR a down word
  // Numbers are assigned left-to-right, top-to-bottom
  const numberMap = new Map<string, number>();
  let currentNumber = 1;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c].black) continue;

      const startsAcross =
        (c === 0 || grid[r][c - 1].black) &&
        c + 1 < size &&
        !grid[r][c + 1].black;

      const startsDown =
        (r === 0 || grid[r - 1][c].black) &&
        r + 1 < size &&
        !grid[r + 1][c].black;

      if (startsAcross || startsDown) {
        numberMap.set(`${r}-${c}`, currentNumber++);
      }
    }
  }

  // Build words array: derive length from the grid (source of truth),
  // filter out single-cell entries (length < 2) which aren't real words.
  const words: Word[] = [];
  for (const w of parsedWords) {
    const [startRow, startCol] = w.startCoords;
    const length = computeWordLength(grid, startRow, startCol, w.direction);
    if (length < 2) {
      console.log(`  Skipping word at (${startRow},${startCol}) ${w.direction}: grid slot length ${length} < 2`);
      continue;
    }
    const number = numberMap.get(`${startRow}-${startCol}`) ?? 0;
    words.push({
      startRow,
      startCol,
      direction: w.direction,
      length,
      number,
      clue: w.clue,
      nextWord: null,
    });
  }

  // Determine if puzzle is incomplete (any word has an empty clue or partially-filled answer)
  const isIncomplete = parsedWords.some((w) => w.cleanAnswer.length === 0 || w.clue === "");

  // Sort words by number then direction (across before down for same number)
  const directionOrder: Record<string, number> = { across: 0, down: 1 };
  words.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    return directionOrder[a.direction] - directionOrder[b.direction];
  });

  // Build output — format depends on completeness
  const baseOutput = {
    version: 1,
    key: randomUUID(),
    gridSize: size,
    grid,
    words,
    title: old.metadata.title,
    author: old.metadata.author,
  };

  const output = isIncomplete
    ? { ...baseOutput, type: "incomplete" as const, displacedClues: [] }
    : { ...baseOutput, type: "complete" as const };

  const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
  if (outputDir && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Converted ${inputPath} -> ${outputPath}`);
  console.log(`Type: ${isIncomplete ? "incomplete" : "complete"}`);
  console.log(`Grid: ${size}x${size}, ${words.length} words, ${old.grid.whiteCells.length} white cells`);
  console.log(`Words with separators: ${parsedWords.filter(w => w.allSeparators.length > 0).length}`);
  console.log(`Words with empty answers: ${parsedWords.filter(w => w.cleanAnswer.length === 0).length}`);
  console.log(`Title: ${old.metadata.title}, Author: ${old.metadata.author}`);
}

// Run conversion
const inputPath = process.argv[2] || "puzzles/oldformat/puzzle1.json";
const outputPath = process.argv[3] || "puzzles/puzzle1.json";
convert(inputPath, outputPath);