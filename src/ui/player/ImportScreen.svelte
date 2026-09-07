<script lang="ts">
  import FilePicker from '../shared/FilePicker.svelte';
  import type { PlayerImportScreenActions } from '../bindings/playerFacade';

  let {
    importError,
    pick,
    actions,
  }: {
    importError: string | null;
    pick: () => Promise<string | null>;
    actions: PlayerImportScreenActions;
  } = $props();

  function onPick(text: string): void {
    actions.importPuzzle(text);
  }
</script>

<main class="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16">
  <h2 class="text-xl font-bold text-gray-800">Import a puzzle to start solving</h2>
  <p class="text-sm text-gray-600 text-center">Select a <strong>complete</strong> puzzle JSON file exported from the Builder, or drag one in.</p>
  <FilePicker label="Pick a puzzle JSON file" pick={pick} onpick={onPick} />
  {#if importError !== null}
    <div class="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      {importError}
    </div>
  {/if}
</main>
