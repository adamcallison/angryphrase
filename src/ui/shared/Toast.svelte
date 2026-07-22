<script lang="ts">
  import type { ToastVM } from '../bindings/viewmodels/toastVM';

  let { toast, onDismiss }: { toast: ToastVM; onDismiss: (id: ToastVM['id']) => void } = $props();

  const kindColor: Record<ToastVM['kind'], string> = {
    info: 'bg-blue-100 text-blue-900 border-blue-300',
    success: 'bg-green-100 text-green-900 border-green-300',
    warning: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    error: 'bg-red-100 text-red-900 border-red-300',
  };

  function onClick(): void {
    onDismiss(toast.id);
  }
</script>

<button
  type="button"
  class={`pointer-events-auto block w-full rounded-md border px-4 py-2 text-left text-sm shadow-sm ${kindColor[toast.kind]}`}
  onclick={onClick}>
  {toast.message}
</button>
