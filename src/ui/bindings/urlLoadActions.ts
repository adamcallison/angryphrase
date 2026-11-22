import type { AppStore } from './appStore.svelte';

type TargetedUrlLoadIntent = { target: 'player'; kind: 'report-url-load-failure' };

export type UrlLoadActions = {
  loadUrl(url: string): Promise<void>;
};

export function createUrlLoadActions(
  appStore: AppStore,
  label: string,
  dispatchFailure: (intent: TargetedUrlLoadIntent) => void,
  onRead: (fileContent: string) => void,
): UrlLoadActions {
  return {
    async loadUrl(url: string) {
      const result = await appStore.getPorts().urlLoad.load(url);
      if (result.kind === 'loaded') {
        onRead(result.text);
        return;
      }
      console.warn(`${label}: failed to load URL:`, result.error);
      dispatchFailure({ target: 'player', kind: 'report-url-load-failure' });
    },
  };
}
