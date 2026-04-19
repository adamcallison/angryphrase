<script lang="ts">
  let {
    onImport,
    error,
  }: {
    onImport: (jsonString: string) => void;
    error: string | null;
  } = $props();

  let fileInput: HTMLInputElement | undefined = $state();

  function handleFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      onImport(content);
    };
    reader.onerror = () => {
      // FileReader errors are rare; the validation layer handles bad content
    };
    reader.readAsText(file);

    // Reset the input so the same file can be re-imported
    input.value = "";
  }

  function handleButtonClick(): void {
    fileInput?.click();
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      // Let the validation layer handle non-JSON files
      const reader = new FileReader();
      reader.onload = () => {
        onImport(reader.result as string);
      };
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onImport(reader.result as string);
    };
    reader.readAsText(file);
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
  }
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh] p-8">
  <h2 class="text-2xl font-bold text-gray-900 mb-2">Import Puzzle</h2>
  <p class="text-gray-500 mb-6">Load a crossword puzzle JSON file to play.</p>

  <!-- Drop zone -->
  <div
    class="w-full max-w-md border-2 border-dashed border-gray-300 rounded-lg p-8
      text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50
      transition-colors"
    onclick={handleButtonClick}
    ondrop={handleDrop}
    ondragover={handleDragOver}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") handleButtonClick(); }}
  >
    <div class="text-gray-500 mb-2">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
    </div>
    <p class="text-gray-600 font-medium">Click or drag a .json file here</p>
    <p class="text-gray-400 text-sm mt-1">Complete puzzle files only</p>
  </div>

  <!-- Hidden file input -->
  <input
    type="file"
    accept=".json"
    bind:this={fileInput}
    onchange={handleFileChange}
    class="hidden"
  />

  {#if error}
    <div class="mt-4 w-full max-w-md bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-700 text-sm font-medium">Import failed</p>
      <p class="text-red-600 text-sm mt-1">{error}</p>
    </div>
  {/if}
</div>