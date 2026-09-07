<script lang="ts">
  let {
    label,
    pick,
    onpick,
  }: {
    label: string;
    pick: () => Promise<string | null>;
    onpick: (text: string) => void;
  } = $props();

  let dragOver = $state(false);

  async function triggerPick(): Promise<void> {
    try {
      const text = await pick();
      if (text === null) return;
      onpick(text);
    } catch (err) {
      console.warn('FilePicker: pickFile failed', err);
    }
  }

  function onDragOver(event: DragEvent): void {
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
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      onpick(text);
    } catch (err) {
      console.warn('FilePicker: drop read failed', err);
    }
  }
</script>

<div
  role="region"
  aria-label="File drop zone"
  class="border-2 border-dashed border-gray-300 p-4 rounded-md text-center transition-colors {dragOver ? 'border-blue-500 bg-blue-50' : ''}"
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <button
    type="button"
    class="rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
    onclick={triggerPick}>
    {label}
  </button>
  <p class="mt-2 text-sm text-gray-500">or drop a file here</p>
</div>
