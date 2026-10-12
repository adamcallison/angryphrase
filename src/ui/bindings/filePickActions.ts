import type { AppStore } from './appStore.svelte';

type TargetedFilePickIntent = { target: 'builder' | 'player' } & FilePickFailureIntent;

export type FilePickFailureIntent =
  | { kind: 'report-import-read-failure' }
  | { kind: 'report-pick-failure' };

export type FilePickActions = {
  pickFile(): Promise<string | null>;
  importDroppedFile(file: File): Promise<void>;
};

export function createFilePickActions(
  appStore: AppStore,
  label: string,
  target: 'builder' | 'player',
  dispatchFailure: (intent: TargetedFilePickIntent) => void,
  onRead: (fileContent: string) => void,
): FilePickActions {
  return {
    async pickFile() {
      const result = await appStore.getPorts().filePick.pickFile();
      if (result.kind === 'picked') return result.text;
      if (result.kind === 'cancelled') return null;
      console.warn(`${label}: pickFile failed:`, result.error);
      dispatchFailure({ target, kind: 'report-pick-failure' });
      return null;
    },
    async importDroppedFile(file: File) {
      const result = await appStore.getPorts().filePick.readDroppedFile(file);
      if (result.kind === 'read') {
        onRead(result.text);
        return;
      }
      console.warn(`${label}: failed to read dropped file:`, result.error);
      dispatchFailure({ target, kind: 'report-import-read-failure' });
    },
  };
}
