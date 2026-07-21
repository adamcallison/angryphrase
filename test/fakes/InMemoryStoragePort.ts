import type { StoragePort } from '../../src/domain/persistence/ports';
import type { PuzzleKey } from '../../src/domain/puzzle/PuzzleKey';

export class InMemoryStoragePort implements StoragePort {
  private builderBlob: string | null = null;
  private playerProgress: Map<string, string> = new Map();

  // For corruption tests: set this to make the next loadX throw.
  public throwOnNextLoad: boolean = false;

  loadBuilder(): string | null {
    if (this.throwOnNextLoad) {
      this.throwOnNextLoad = false;
      throw new Error('simulated storage read error');
    }
    return this.builderBlob;
  }

  saveBuilder(blob: string): void {
    this.builderBlob = blob;
  }

  clearBuilder(): void {
    this.builderBlob = null;
  }

  loadPlayerProgress(key: PuzzleKey): string | null {
    if (this.throwOnNextLoad) {
      this.throwOnNextLoad = false;
      throw new Error('simulated storage read error');
    }
    return this.playerProgress.get(key) ?? null;
  }

  savePlayerProgress(key: PuzzleKey, blob: string): void {
    this.playerProgress.set(key, blob);
  }

  clearPlayerProgress(key: PuzzleKey): void {
    this.playerProgress.delete(key);
  }

  // Test helpers (not part of StoragePort):
  getBuilderBlob(): string | null {
    return this.builderBlob;
  }

  getPlayerProgressMap(): Map<string, string> {
    return this.playerProgress;
  }
}
