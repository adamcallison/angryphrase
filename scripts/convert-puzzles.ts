import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { parsePuzzleV1, serializeComplete, serializeIncomplete } from '../src/domain/format/v1';

type SourceCell = {
  black: boolean;
  letter?: string | null;
  puzzleLetter?: string | null;
  spaceRight: boolean;
  spaceBottom: boolean;
  hyphenRight: boolean;
  hyphenBottom: boolean;
};

type SourceWord = {
  startRow: number;
  startCol: number;
  direction: 'across' | 'down';
  length: number;
  number: number;
  clue: string;
  nextWord: { startRow: number; startCol: number; direction: 'across' | 'down' } | null;
};

type SourceDoc = {
  version: 1;
  type?: 'complete' | 'incomplete';
  key: string;
  gridSize: number;
  grid: SourceCell[][];
  words: SourceWord[];
  title: string;
  author: string;
  displacedClues?: unknown[];
};

function cellLetter(cell: SourceCell): string | null {
  if (cell.puzzleLetter !== undefined) return cell.puzzleLetter;
  return cell.letter ?? null;
}

function migrate(source: SourceDoc): string {
  const allWhiteFilled = source.grid.every((row) =>
    row.every((cell) => {
      if (cell.black) return true;
      const letter = cellLetter(cell);
      return typeof letter === 'string' && letter.length === 1;
    }),
  );
  const type: 'incomplete' | 'complete' = allWhiteFilled ? 'complete' : 'incomplete';

  const transformedGrid = source.grid.map((row) =>
    row.map((cell) => ({
      black: cell.black,
      puzzleLetter: cellLetter(cell),
      spaceRight: cell.spaceRight ?? false,
      spaceBottom: cell.spaceBottom ?? false,
      hyphenRight: cell.hyphenRight ?? false,
      hyphenBottom: cell.hyphenBottom ?? false,
    })),
  );

  const out: Record<string, unknown> = {
    version: 1,
    type,
    key: source.key,
    gridSize: source.gridSize,
    title: source.title,
    author: source.author,
    grid: transformedGrid,
    words: source.words,
  };
  if (type === 'incomplete') {
    out.displacedClues = source.displacedClues ?? [];
  }

  const json = JSON.stringify(out);
  const result = parsePuzzleV1(json);
  if (!result.ok) {
    throw new Error(
      `Validation failed: ${result.failures.map((e) => e.message ?? JSON.stringify(e)).join('; ')}`,
    );
  }
  if (result.fileType !== type) {
    throw new Error(`Parser inferred type '${result.fileType}' but expected '${type}'`);
  }

  return type === 'complete'
    ? serializeComplete(result.puzzle)
    : serializeIncomplete(result.puzzle, result.displacedClues);
}

function main(): void {
  const srcDir = join(process.cwd(), 'puzzles');
  const outDir = join(process.cwd(), 'converted-puzzles');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const files = readdirSync(srcDir).filter((f) => f.endsWith('.json'));
  let ok = 0;
  let failed = 0;
  for (const f of files) {
    const srcPath = join(srcDir, f);
    const outPath = join(outDir, basename(f, extname(f)) + '.json');
    try {
      const raw = readFileSync(srcPath, 'utf-8');
      const source = JSON.parse(raw) as SourceDoc;
      const canonical = migrate(source);
      writeFileSync(outPath, canonical, 'utf-8');
      console.log(`OK ${f} -> converted-puzzles/${f}`);
      ok++;
    } catch (err) {
      console.error(`FAIL ${f}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }
  console.log(`\nSummary: ${ok}/${ok + failed} puzzles converted; ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main();
