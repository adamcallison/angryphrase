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

<div class="flex flex-col gap-3">
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="px-4 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700
        hover:bg-gray-50 transition-colors"
      onclick={onSave}
    >
      Save
    </button>

    <div class="relative group">
      <button
        type="button"
        class="px-4 py-1.5 text-sm font-medium rounded border transition-colors
          {canExportComplete
          ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'}"
        disabled={!canExportComplete}
        onclick={onExportComplete}
      >
        Export Complete
      </button>
      {#if !canExportComplete && exportErrors.length > 0}
        <div
          class="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10
            bg-gray-800 text-white text-xs rounded px-3 py-2 whitespace-nowrap max-w-xs"
        >
          {exportErrors.join("; ")}
        </div>
      {/if}
    </div>

    <button
      type="button"
      class="px-4 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700
        hover:bg-gray-50 transition-colors"
      onclick={onImport}
    >
      Import
    </button>

    <button
      type="button"
      class="px-4 py-1.5 text-sm font-medium rounded border border-red-300 bg-white text-red-600
        hover:bg-red-50 transition-colors"
      onclick={onReset}
    >
      Reset
    </button>
  </div>

  {#if !canExportComplete && exportErrors.length > 0}
    <p class="text-xs text-amber-600">
      Cannot export: {exportErrors.join("; ")}
    </p>
  {/if}
</div>