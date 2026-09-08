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

export type PickResult =
  | { kind: 'picked'; text: string }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: Error };

export type DroppedFileResult =
  | { kind: 'read'; text: string }
  | { kind: 'failed'; error: Error };

export interface FilePickPort {
  pickFile(): Promise<PickResult>;
  readDroppedFile(file: File): Promise<DroppedFileResult>; // drag-and-drop read; re-baselined P4 onto a 2-way union — a drop has no cancel path
}
