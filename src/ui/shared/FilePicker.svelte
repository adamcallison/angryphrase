<script lang="ts">
  let {
    label,
    pick,
    onpick,
    ondropfile,
  }: {
    label: string;
    pick: () => Promise<string | null>;
    onpick: (text: string) => void;
    ondropfile: (file: File) => void;
  } = $props();

  let dragOver = $state(false);

  async function triggerPick(): Promise<void> {
    const text = await pick();
    if (text === null) return;
    onpick(text);
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

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    ondropfile(file);
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
