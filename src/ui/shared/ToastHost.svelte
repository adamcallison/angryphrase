<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ToastVM, ToastHostActions } from '../bindings/toastFacade';
  import type { ToastId } from '../../domain/notifications/ToastId';
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
        timers.set(vm.id, setTimeout(() => actions.dismiss(vm.id), Number(vm.ttlMs)));
      }
    }
  });

  onDestroy(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });
</script>

<div class="pointer-events-none fixed top-4 right-4 z-50 flex w-72 flex-col gap-2 sm:right-4 max-sm:bottom-4 max-sm:left-1/2 max-sm:right-4 max-sm:-translate-x-1/2 sm:bottom-auto sm:left-auto sm:translate-x-0">
  {#each vms as toast (toast.id)}
    <Toast {toast} onDismiss={actions.dismiss} />
  {/each}
</div>
