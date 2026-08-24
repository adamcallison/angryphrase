import type { PuzzleKey } from '../puzzle/PuzzleKey';

export interface StoragePort {
  loadBuilder(): string | null;
  saveBuilder(blob: string): void;
  clearBuilder(): void;
  loadPlayerProgress(key: PuzzleKey): string | null;
  savePlayerProgress(key: PuzzleKey, blob: string): void;
  clearPlayerProgress(key: PuzzleKey): void;
}

export interface DownloadPort {
  download(filename: string, content: string): Error | null; // null = success; Error = failure
}

export interface FilePickPort {
  pickFile(): Promise<string | null>;
}
