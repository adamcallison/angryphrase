<script lang="ts">
  import { toastVMs, dismissToast } from '../bindings/toastStore.svelte';
  import { getToasts } from '../bindings/appStore.svelte';
  import Toast from './Toast.svelte';

  // Auto-dismiss per toast: re-runs whenever the underlying toast list identity changes.
  $effect(() => {
    const toasts = getToasts();
    const timers = toasts.map((t) => {
      // Per C2 = 3500 ms default (the toast carries its own ttlMs picked up by Toast.create).
      return setTimeout(() => dismissToast(t.id), t.ttlMs);
    });
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  });
</script>

<div class="pointer-events-none fixed top-4 right-4 z-50 flex w-72 flex-col gap-2 sm:right-4 max-sm:bottom-4 max-sm:left-1/2 max-sm:right-4 max-sm:-translate-x-1/2 sm:bottom-auto sm:left-auto sm:translate-x-0">
  {#each toastVMs() as toast (toast.id)}
    <Toast {toast} onDismiss={dismissToast} />
  {/each}
</div>
