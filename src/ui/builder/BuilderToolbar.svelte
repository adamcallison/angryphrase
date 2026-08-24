<script lang="ts">
  import {
    dispatchSwitchToFill,
    dispatchRequestSwitchToDesign,
    dispatchChangeGridSize,
    dispatchToggleMarker,
    dispatchExportIncomplete,
    dispatchExportComplete,
    dispatchRequestResetBuilder,
    dispatchEditTitle,
    dispatchEditAuthor,
    dispatchRequestImportPuzzle,
  } from '../bindings/builderStore.svelte';
  import type { BuilderToolbarVM } from '../bindings/viewmodels/builderVM';
  import type { CellMarkerFlag } from '../../domain/grid/CellMarkerFlag';
  import type { CellMarker } from '../../domain/grid/CellMarker';
  import FilePicker from '../shared/FilePicker.svelte';
  import GridSizeControl from './GridSizeControl.svelte';

  let {
    vm,
    title,
    author,
  }: {
    vm: BuilderToolbarVM;
    title: string;
    author: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let titleDraft = $state(title);
  // svelte-ignore state_referenced_locally
  let authorDraft = $state(author);

  $effect(() => {
    titleDraft = title;
  });
  $effect(() => {
    authorDraft = author;
  });

  const markerButtons: { flag: 'space-right' | 'space-bottom' | 'hyphen-right' | 'hyphen-bottom'; label: string }[] = [
    { flag: 'space-right', label: 'Space right' },
    { flag: 'space-bottom', label: 'Space bottom' },
    { flag: 'hyphen-right', label: 'Hyphen right' },
    { flag: 'hyphen-bottom', label: 'Hyphen bottom' },
  ];

  const markerFlagToKey: Record<CellMarkerFlag, keyof CellMarker> = {
    'space-right': 'spaceRight',
    'space-bottom': 'spaceBottom',
    'hyphen-right': 'hyphenRight',
    'hyphen-bottom': 'hyphenBottom',
  };

  function onImportPicked(text: string | null, errorMessage: string | null): void {
    if (errorMessage !== null) {
      console.warn('BuilderToolbar: import failed:', errorMessage);
      return;
    }
    if (text === null) return;
    dispatchRequestImportPuzzle(text);
  }
</script>

<div class="flex flex-col gap-4 p-4">
  <!-- Title / author row -->
  <div class="flex flex-wrap items-center gap-4">
    <label class="flex items-center gap-2 text-sm text-gray-700">
      Title
      <input
        type="text"
        bind:value={titleDraft}
        onchange={() => dispatchEditTitle(titleDraft)}
        class="rounded border border-gray-300 px-2 py-1 text-sm"
      />
    </label>
    <label class="flex items-center gap-2 text-sm text-gray-700">
      Author
      <input
        type="text"
        bind:value={authorDraft}
        onchange={() => dispatchEditAuthor(authorDraft)}
        class="rounded border border-gray-300 px-2 py-1 text-sm"
      />
    </label>
  </div>

  <!-- Mode toggle -->
  <div class="flex items-center gap-2">
    <span class="text-sm text-gray-700">Mode:</span>
    <button
      type="button"
      class="rounded px-3 py-1 text-sm font-medium {vm.mode === 'design'
        ? 'bg-blue-600 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
      onclick={() => dispatchRequestSwitchToDesign()}
    >
      Design
    </button>
    <button
      type="button"
      class="rounded px-3 py-1 text-sm font-medium {vm.mode === 'fill'
        ? 'bg-blue-600 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
      onclick={() => dispatchSwitchToFill()}
    >
      Fill
    </button>
  </div>

  <!-- Grid size -->
  <GridSizeControl
    value={vm.gridSizeInput}
    min={vm.minGridSize}
    max={vm.maxGridSize}
    disabled={!vm.canChangeGridSize}
    onCommit={(n) => dispatchChangeGridSize(n)}
  />

  <!-- Marker toolbar -->
  <div class="flex flex-wrap items-center gap-2">
    <span class="text-sm text-gray-700">Markers:</span>
    {#each markerButtons as { flag, label }}
      <button
        type="button"
        disabled={!vm.cellSelected}
        class="rounded px-2 py-1 text-sm font-medium {vm.markerFlags[markerFlagToKey[flag]]
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={() => dispatchToggleMarker(flag)}
      >
        {label}
      </button>
    {/each}
  </div>

  <!-- Import / export / reset -->
  <div class="flex flex-wrap items-center gap-2">
    <FilePicker label="Import" onpick={onImportPicked} />
    <button
      type="button"
      class="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-300"
      onclick={() => dispatchExportIncomplete()}
    >
      Export Incomplete
    </button>
    <button
      type="button"
      disabled={!vm.canExportComplete}
      class="rounded px-3 py-1 text-sm font-medium {vm.canExportComplete
        ? 'bg-green-600 text-white hover:bg-green-700'
        : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
      onclick={() => dispatchExportComplete()}
    >
      Export Complete
    </button>
    <button
      type="button"
      class="rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
      onclick={() => dispatchRequestResetBuilder()}
    >
      Reset
    </button>
  </div>
</div>
