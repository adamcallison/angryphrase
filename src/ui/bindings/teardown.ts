import type { AppStore } from './appStore.svelte';

export function installTeardown(store: AppStore): void {
  window.addEventListener('pagehide', () => {
    store.getScheduler().flush();
  });
}
