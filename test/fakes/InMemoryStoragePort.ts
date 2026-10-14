import type { LoadResult, StoragePort } from '../../src/domain/ports/ports';
import type { PuzzleKey } from '../../src/domain/puzzle/PuzzleKey';

export class InMemoryStoragePort implements StoragePort {
  private builderBlob: string | null = null;
  private playerProgress: Map<string, string> = new Map();

  // For read-failure tests: set this to make the next load return the Error without reading storage.
  public simulateFailure: Error | null = null;

  // For write-failure tests: set this to make the next write return the Error without mutating storage.
  public nextWriteError: Error | null = null;

  loadBuilder(): LoadResult<string> {
    if (this.simulateFailure !== null) {
      const error = this.simulateFailure;
      this.simulateFailure = null;
      return { kind: 'failed', error };
    }
    return this.builderBlob === null ? { kind: 'absent' } : { kind: 'loaded', value: this.builderBlob };
  }

  saveBuilder(blob: string): Error | null {
    if (this.nextWriteError !== null) {
      const err = this.nextWriteError;
      this.nextWriteError = null;
      return err;
    }
    this.builderBlob = blob;
    return null;
  }

  clearBuilder(): Error | null {
    if (this.nextWriteError !== null) {
      const err = this.nextWriteError;
      this.nextWriteError = null;
      return err;
    }
    this.builderBlob = null;
    return null;
  }

  loadPlayerProgress(key: PuzzleKey): LoadResult<string> {
    if (this.simulateFailure !== null) {
      const error = this.simulateFailure;
      this.simulateFailure = null;
      return { kind: 'failed', error };
    }
    const value = this.playerProgress.get(key);
    return value === undefined ? { kind: 'absent' } : { kind: 'loaded', value };
  }

  savePlayerProgress(key: PuzzleKey, blob: string): Error | null {
    if (this.nextWriteError !== null) {
      const err = this.nextWriteError;
      this.nextWriteError = null;
      return err;
    }
    this.playerProgress.set(key, blob);
    return null;
  }

  clearPlayerProgress(key: PuzzleKey): Error | null {
    if (this.nextWriteError !== null) {
      const err = this.nextWriteError;
      this.nextWriteError = null;
      return err;
    }
    this.playerProgress.delete(key);
    return null;
  }

  // Test helpers (not part of StoragePort):
  getBuilderBlob(): string | null {
    return this.builderBlob;
  }

  getPlayerProgressMap(): Map<string, string> {
    return this.playerProgress;
  }
}
