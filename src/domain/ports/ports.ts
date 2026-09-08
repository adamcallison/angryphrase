import type { PuzzleKey } from '../puzzle/PuzzleKey';

export interface StoragePort {
  loadBuilder(): string | null;
  saveBuilder(blob: string): Error | null;            // null = success; Error = write failed (silent; appStore warns/toasts)
  clearBuilder(): Error | null;                       // null = success; Error = write failed (silent; appStore warns/toasts)
  loadPlayerProgress(key: PuzzleKey): string | null;
  savePlayerProgress(key: PuzzleKey, blob: string): Error | null;  // null = success; Error = write failed (silent; appStore warns/toasts)
  clearPlayerProgress(key: PuzzleKey): Error | null;  // null = success; Error = write failed (silent; appStore warns/toasts)
}

export interface DownloadPort {
  download(filename: string, content: string): Error | null; // null = success; Error = failure
}

export interface FilePickPort {
  pickFile(): Promise<string | null>;
  readDroppedFile(file: File): Promise<string | null>; // drag-and-drop read; null = read failed (no cancel path for drops; impl warns once)
}
