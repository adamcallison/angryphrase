<script lang="ts">
  import type { BuilderToolbarActions } from '../bindings/builderFacade';
  import type { BuilderToolbarVM } from '../bindings/viewmodels/builderVM';
  import FilePicker from '../shared/FilePicker.svelte';
  import GridSizeControl from './GridSizeControl.svelte';

  let {
    vm,
    title,
    author,
    actions,
    pick,
  }: {
    vm: BuilderToolbarVM;
    title: string;
    author: string;
    actions: BuilderToolbarActions;
    pick: () => Promise<string | null>;
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

  const markerButtons: { axis: 'right' | 'bottom'; separator: 'space' | 'hyphen'; label: string }[] = [
    { axis: 'right', separator: 'space', label: 'Space right' },
    { axis: 'bottom', separator: 'space', label: 'Space bottom' },
    { axis: 'right', separator: 'hyphen', label: 'Hyphen right' },
    { axis: 'bottom', separator: 'hyphen', label: 'Hyphen bottom' },
  ];


</script>

<div class="flex flex-col gap-4 p-4">
  <!-- Title / author row -->
  <div class="flex flex-wrap items-center gap-4">
    <label class="flex items-center gap-2 text-sm text-gray-700">
      Title
      <input
        type="text"
        bind:value={titleDraft}
        onchange={() => actions.editTitle(titleDraft)}
        class="rounded border border-gray-300 px-2 py-1 text-sm"
      />
    </label>
    <label class="flex items-center gap-2 text-sm text-gray-700">
      Author
      <input
        type="text"
        bind:value={authorDraft}
        onchange={() => actions.editAuthor(authorDraft)}
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
      onclick={() => actions.requestSwitchToDesign()}
    >
      Design
    </button>
    <button
      type="button"
      class="rounded px-3 py-1 text-sm font-medium {vm.mode === 'fill'
        ? 'bg-blue-600 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
      onclick={() => actions.switchToFill()}
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
    onCommit={(n) => actions.changeGridSize(n)}
  />

  <!-- Marker toolbar -->
  <div class="flex flex-wrap items-center gap-2">
    <span class="text-sm text-gray-700">Markers:</span>
    {#each markerButtons as { axis, separator, label }}
      <button
        type="button"
        disabled={!vm.cellSelected}
        class="rounded px-2 py-1 text-sm font-medium {vm.markerFlags[axis] === separator
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={() => actions.setMarker(axis, separator)}
      >
        {label}
      </button>
    {/each}
  </div>

  <!-- Import / export / reset -->
  <div class="flex flex-wrap items-center gap-2">
    <FilePicker label="Import" pick={pick} onpick={(text) => actions.requestImportPuzzle(text)} ondropfile={(file) => actions.importDroppedFile(file)} />
    <button
      type="button"
      class="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-300"
      onclick={() => actions.exportIncomplete()}
    >
      Export Incomplete
    </button>
    <button
      type="button"
      disabled={!vm.canExportComplete}
      class="rounded px-3 py-1 text-sm font-medium {vm.canExportComplete
        ? 'bg-green-600 text-white hover:bg-green-700'
        : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
      onclick={() => actions.exportComplete()}
    >
      Export Complete
    </button>
    {#if vm.violationSummary.length > 0}
      <div class="flex flex-col gap-1">
        {#each vm.violationSummary as item}
          <p class="text-sm text-red-600">{item.label}</p>
        {/each}
      </div>
    {/if}
    <button
      type="button"
      class="rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
      onclick={() => actions.requestResetBuilder()}
    >
      Reset
    </button>
  </div>
</div>
