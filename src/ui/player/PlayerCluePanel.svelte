<script lang="ts">
  import type { CluePanelVM } from '../bindings/viewmodels/cluePanelVM';
  import { dispatchPlayer } from '../bindings/playerStore.svelte';

  let { vm }: { vm: CluePanelVM } = $props();

  function highlightedId(): string | null {
    if (vm.highlightedWordKey === null) return null;
    const key = vm.highlightedWordKey;
    // Find the entry whose wordKey matches (across or down) and return its row id.
    const across = vm.across.find((e) =>
      Number(e.wordKey.startRow) === Number(key.startRow) &&
      Number(e.wordKey.startCol) === Number(key.startCol) &&
      e.wordKey.direction === key.direction);
    if (across) return `across-${Number(across.number)}`;
    const down = vm.down.find((e) =>
      Number(e.wordKey.startRow) === Number(key.startRow) &&
      Number(e.wordKey.startCol) === Number(key.startCol) &&
      e.wordKey.direction === key.direction);
    if (down) return `down-${Number(down.number)}`;
    return null;
  }

  $effect(() => {
    const id = highlightedId();
    if (id === null) return;
    document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  });
</script>

<aside class="flex w-full max-w-md flex-col gap-4 max-h-[70vh] overflow-y-auto">
  <section>
    <h2 class="text-sm font-semibold text-gray-700">Across</h2>
    <ul class="flex flex-col gap-1">
      {#each vm.across as entry}
        {@const rowId = `across-${Number(entry.number)}`}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <li
          id={rowId}
          class="flex items-start gap-2 rounded p-1 cursor-pointer {entry.isSelected ? 'bg-yellow-100' : ''}"
          onclick={() => {
            dispatchPlayer({ kind: 'click-clue-panel-word', wordKey: entry.wordKey });
            (document.getElementById('typing-surface-input') as HTMLInputElement | null)?.focus();
          }}
        >
          <span class="font-bold text-gray-800">{Number(entry.number)}.</span>
          <div class="flex flex-col gap-0.5 flex-1">
            <span class="text-sm text-gray-800">{entry.displayClue}</span>
            {#if entry.isChainHead && entry.lengthPattern !== null}
              <span class="text-xs text-gray-500">({entry.lengthPattern})</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>
  <section>
    <h2 class="text-sm font-semibold text-gray-700">Down</h2>
    <ul class="flex flex-col gap-1">
      {#each vm.down as entry}
        {@const rowId = `down-${Number(entry.number)}`}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <li
          id={rowId}
          class="flex items-start gap-2 rounded p-1 cursor-pointer {entry.isSelected ? 'bg-yellow-100' : ''}"
          onclick={() => {
            dispatchPlayer({ kind: 'click-clue-panel-word', wordKey: entry.wordKey });
            (document.getElementById('typing-surface-input') as HTMLInputElement | null)?.focus();
          }}
        >
          <span class="font-bold text-gray-800">{Number(entry.number)}.</span>
          <div class="flex flex-col gap-0.5 flex-1">
            <span class="text-sm text-gray-800">{entry.displayClue}</span>
            {#if entry.isChainHead && entry.lengthPattern !== null}
              <span class="text-xs text-gray-500">({entry.lengthPattern})</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>
</aside>
