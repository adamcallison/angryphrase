<script lang="ts">
  import type { ToastVM } from '../bindings/viewmodels/toastVM';

  let { toast, onDismiss }: { toast: ToastVM; onDismiss: (id: ToastVM['id']) => void } = $props();

  const kindColor: Record<ToastVM['kind'], string> = {
    info: 'bg-info-soft text-info-soft-text border-info-border',
    success: 'bg-success-soft text-success-soft-text border-success-border',
    warning: 'bg-warning-soft text-warning-soft-text border-warning-border',
    error: 'bg-danger-soft text-danger-soft-text border-danger-border',
  };

  function onClick(): void {
    onDismiss(toast.id);
  }
</script>

<button
  type="button"
  class={`pointer-events-auto block w-full rounded-md border px-4 py-2 text-left text-sm shadow-sm focus-ring ${kindColor[toast.kind]}`}
  onclick={onClick}>
  {toast.message}
</button>
