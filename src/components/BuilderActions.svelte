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
    onImport: () => void;
    onReset: () => void;
  } = $props();
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
      onclick={onImport}
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