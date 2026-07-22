<script lang="ts">
  import { getPorts } from '../bindings/ports';

  // Props:
  //   accept — comma-separated accepted MIME list (default: 'application/json,.json')
  //   label  — visual label for the trigger button text
  //   disabled — disables both drag-drop and click (default false)
  let {
    accept = 'application/json,.json',
    label = 'Pick a file',
    disabled = false,
    onpick,
  }: {
    accept?: string;
    label?: string;
    disabled?: boolean;
    onpick: (text: string | null, errorMessage: string | null) => void;
  } = $props();

  let dragOver = $state(false);

  async function triggerPick(): Promise<void> {
    if (disabled) return;
    try {
      const text = await getPorts().filePick.pickFile();
      if (text === null) {
        onpick(null, null); // user cancelled
        return;
      }
      onpick(text, null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('FilePicker: pickFile failed', err);
      onpick(null, message);
    }
  }

  function onDragOver(event: DragEvent): void {
    if (disabled) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    dragOver = true;
  }

  function onDragLeave(): void {
    dragOver = false;
  }

  async function onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    dragOver = false;
    if (disabled) return;
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      onpick(null, null);
      return;
    }
    try {
      const text = await file.text();
      onpick(text, null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('FilePicker: drop read failed', err);
      onpick(null, message);
    }
  }
</script>

<div
  role="region"
  aria-label="File drop zone"
  data-accept={accept}
  class="border-2 border-dashed border-gray-300 p-4 rounded-md text-center transition-colors {dragOver ? 'border-blue-500 bg-blue-50' : ''} {disabled ? 'opacity-50 pointer-events-none' : ''}"
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <button
    type="button"
    class="rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
    {disabled}
    onclick={triggerPick}>
    {label}
  </button>
  <p class="mt-2 text-sm text-gray-500">or drop a file here</p>
</div>
