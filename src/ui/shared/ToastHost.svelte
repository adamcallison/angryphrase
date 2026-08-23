<script lang="ts">
  import { onDestroy } from 'svelte';
  import { toastVMs, dismissToast } from '../bindings/toastStore.svelte';
  import { getToasts } from '../bindings/appStore.svelte';
  import Toast from './Toast.svelte';
  import type { ToastId } from '../../domain/notifications/ToastId';

  // Auto-dismiss per toast: each toast gets exactly one timer, scheduled when it first
  // appears; timers for dismissed toasts are cleared. Sibling mutations no longer reset
  // unrelated timers. Deadline ≈ createdAt + ttlMs (default 3500 ms).
  const timers = new Map<ToastId, ReturnType<typeof setTimeout>>();

  $effect(() => {
    const toasts = getToasts();
    const liveIds = new Set(toasts.map((t) => t.id));
    for (const [id, timer] of timers) {
      if (!liveIds.has(id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
    for (const t of toasts) {
      if (!timers.has(t.id)) {
        timers.set(t.id, setTimeout(() => dismissToast(t.id), Number(t.ttlMs)));
      }
    }
  });

  onDestroy(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });
</script>

<div class="pointer-events-none fixed top-4 right-4 z-50 flex w-72 flex-col gap-2 sm:right-4 max-sm:bottom-4 max-sm:left-1/2 max-sm:right-4 max-sm:-translate-x-1/2 sm:bottom-auto sm:left-auto sm:translate-x-0">
  {#each toastVMs() as toast (toast.id)}
    <Toast {toast} onDismiss={dismissToast} />
  {/each}
</div>
