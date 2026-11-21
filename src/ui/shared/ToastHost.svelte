<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ToastVM, ToastHostActions } from '../bindings/toastFacade';
  import type { ToastId } from '../../domain/notifications/Toast';
  import Toast from './Toast.svelte';

  let { vms, actions }: { vms: ToastVM[]; actions: ToastHostActions } = $props();

  // Auto-dismiss per toast: each toast gets exactly one timer, scheduled when it first
  // appears; timers for dismissed toasts are cleared. Sibling mutations no longer reset
  // unrelated timers. Deadline ≈ createdAt + ttlMs (default 3500 ms).
  const timers = new Map<ToastId, ReturnType<typeof setTimeout>>();

  $effect(() => {
    const liveIds = new Set(vms.map((vm) => vm.id));
    for (const [id, timer] of timers) {
      if (!liveIds.has(id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
    for (const vm of vms) {
      if (!timers.has(vm.id)) {
        timers.set(vm.id, setTimeout(() => actions.dismiss(vm.id), vm.ttlMs));
      }
    }
  });

  onDestroy(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });
</script>

<div class="pointer-events-none fixed bottom-[calc(1rem_+_var(--toast-bottom-inset))] left-1/2 -translate-x-1/2 z-toast flex w-72 flex-col gap-2 md:bottom-auto md:left-auto md:translate-x-0 md:top-4 md:right-4">
  {#each vms as toast (toast.id)}
    <Toast {toast} onDismiss={actions.dismiss} />
  {/each}
</div>

<!-- Visually-hidden announcer: sibling of the visual stack so it is independent
     of toast placement and contains no interactive elements. role="status"
     implies aria-live="polite"; removals (auto-dismiss) are not announced,
     insertions are. -->
<div class="sr-only" role="status">
  {#each vms as toast (toast.id)}
    <div>{toast.announcement}</div>
  {/each}
</div>
