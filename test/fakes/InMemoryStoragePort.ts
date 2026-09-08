import type { StoragePort } from '../../src/domain/ports/ports';
import type { PuzzleKey } from '../../src/domain/puzzle/PuzzleKey';

export class InMemoryStoragePort implements StoragePort {
  private builderBlob: string | null = null;
  private playerProgress: Map<string, string> = new Map();

  // For corruption tests: set this to make the next loadX throw.
  public throwOnNextLoad: boolean = false;

  // For write-failure tests: set this to make the next write return the Error without mutating storage.
  public nextWriteError: Error | null = null;

  loadBuilder(): string | null {
    if (this.throwOnNextLoad) {
      this.throwOnNextLoad = false;
      throw new Error('simulated storage read error');
    }
    return this.builderBlob;
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

  loadPlayerProgress(key: PuzzleKey): string | null {
    if (this.throwOnNextLoad) {
      this.throwOnNextLoad = false;
      throw new Error('simulated storage read error');
    }
    return this.playerProgress.get(key) ?? null;
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
