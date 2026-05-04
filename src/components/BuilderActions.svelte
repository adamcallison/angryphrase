<script lang="ts">
  let {
    canExportComplete,
    exportErrors,
    onSave,
    onExportComplete,
    onImport,
    onReset,
  }: {
    canExportComplete: boolean;
    exportErrors: string[];
    onSave: () => void;
    onExportComplete: () => void;
    onImport: (jsonString: string) => void;
    onReset: () => void;
  } = $props();

  let fileInput: HTMLInputElement | undefined = $state();

  /** Reads a File as text. Rejects if the read fails. */
  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      onImport(content);
    } catch {
      // FileReader errors are rare; the validation layer handles bad content
    }

    // Reset the input so the same file can be re-imported
    input.value = "";
  }
</script>

<div class="actions">
  <div class="actions__row">
    <button
      type="button"
      class="btn btn--secondary"
      onclick={onSave}
    >
      Save
    </button>

    <div class="actions__export-wrapper">
      <button
        type="button"
        class="btn {canExportComplete ? 'btn--export-active' : 'btn--export-disabled'}"
        disabled={!canExportComplete}
        onclick={onExportComplete}
      >
        Export Complete
      </button>
      {#if !canExportComplete && exportErrors.length > 0}
        <div class="actions__tooltip">
          {exportErrors.join("; ")}
        </div>
      {/if}
    </div>

    <button
      type="button"
      class="btn btn--secondary"
      onclick={() => fileInput?.click()}
    >
      Import
    </button>

    <button
      type="button"
      class="btn btn--danger"
      onclick={onReset}
    >
      Reset
    </button>
  </div>

  <!-- Hidden file input -->
  <input
    type="file"
    accept=".json"
    bind:this={fileInput}
    onchange={handleFileChange}
    class="hidden"
  />

  {#if !canExportComplete && exportErrors.length > 0}
    <p class="actions__error-hint">
      Cannot export: {exportErrors.join("; ")}
    </p>
  {/if}
</div>

<style>
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem; /* gap-3 */
  }

  .actions__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem; /* gap-2 */
  }

  .btn {
    padding: 0.375rem 1rem; /* py-1.5 px-4 */
    font-size: 0.875rem; /* text-sm */
    font-weight: 500; /* font-medium */
    border-radius: 0.25rem; /* rounded */
    border: 1px solid #d1d5db; /* gray-300 */
    cursor: pointer;
    transition: colors 0.15s;
  }

  .btn--secondary {
    background: white;
    color: #374151; /* gray-700 */
  }

  .btn--secondary:hover {
    background: #f9fafb; /* gray-50 */
  }

  .btn--export-active {
    background: #f0fdf4; /* green-50 */
    color: #15803d; /* green-700 */
    border-color: #16a34a; /* green-600 */
  }

  .btn--export-active:hover {
    background: #dcfce7; /* green-100 */
  }

  .btn--export-disabled {
    background: #f3f4f6; /* gray-100 */
    color: #9ca3af; /* gray-400 */
    border-color: #d1d5db; /* gray-300 */
    cursor: not-allowed;
  }

  .btn--danger {
    background: white;
    color: #dc2626; /* red-600 */
    border-color: #fca5a5; /* red-300 */
  }

  .btn--danger:hover {
    background: #fef2f2; /* red-50 */
  }

  .actions__export-wrapper {
    position: relative;
  }

  .actions__tooltip {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 0.5rem; /* mb-2 */
    background: #1f2937; /* gray-800 */
    color: white;
    font-size: 0.75rem; /* text-xs */
    border-radius: 0.25rem;
    padding: 0.5rem 0.75rem; /* py-2 px-3 */
    white-space: nowrap;
    max-width: 20rem; /* max-w-xs */
    z-index: 10;
    display: none;
  }

  .actions__export-wrapper:hover .actions__tooltip {
    display: block;
  }

  .actions__error-hint {
    font-size: 0.75rem; /* text-xs */
    color: #d97706; /* amber-600 */
  }
</style>