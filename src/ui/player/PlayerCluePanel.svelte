<script lang="ts">
  import type { CluePanelVM, ClueEntryVM } from '../bindings/viewmodels/cluePanelVM';
  import type { PlayerCluePanelActions } from '../bindings/playerFacade';
  import { scrollRowIntoView } from '../shared/clueScroll';

  let { vm, actions }: { vm: CluePanelVM; actions: PlayerCluePanelActions } = $props();

  let panelEl: HTMLElement | null = $state(null);

  let liRefs: Record<string, HTMLElement> = $state({});

  $effect(() => {
    const id = vm.highlightedId;
    if (id === null) return;
    scrollRowIntoView(panelEl, liRefs, id);
  });

  const tabStopId: string | null = $derived.by(() => {
    if (vm.highlightedId !== null) return vm.highlightedId;
    const first =
      vm.across.length > 0 ? vm.across.at(0) : vm.down.length > 0 ? vm.down.at(0) : undefined;
    return first?.id ?? null;
  });

  const allEntries: ClueEntryVM[] = $derived([...vm.across, ...vm.down]);

  function onOptionKeydown(e: KeyboardEvent, entry: ClueEntryVM): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const idx = allEntries.findIndex((x) => x.id === entry.id);
      const next = e.key === 'ArrowDown' ? allEntries.at(idx + 1) : allEntries.at(idx - 1);
      // A true end of the list: swallow the key so the default scroll never fires.
      if (next === undefined) {
        e.preventDefault();
        return;
      }
      // Browsing the list must not fight the typing surface for focus (Focus section).
      actions.browseCluePanelWord(next.wordKey);
      liRefs[next.id]?.focus();
      e.preventDefault();
    } else if (e.key === 'Home' || e.key === 'End') {
      const next = e.key === 'Home' ? allEntries.at(0) : allEntries.at(-1);
      if (next === undefined) {
        e.preventDefault();
        return;
      }
      actions.browseCluePanelWord(next.wordKey);
      liRefs[next.id]?.focus();
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') {
      actions.clickCluePanelWord(entry.wordKey);
      e.preventDefault();
    }
  }
</script>

{#snippet clueRow(entry: ClueEntryVM)}
  <li
    bind:this={liRefs[entry.id]}
    role="option"
    aria-selected={entry.id === vm.highlightedId}
    tabindex={entry.id === tabStopId ? 0 : -1}
    class="flex items-start gap-2 rounded p-1 cursor-pointer focus-ring {entry.isSelected ? 'bg-hilite-word' : ''}"
    onclick={() => {
      actions.clickCluePanelWord(entry.wordKey);
    }}
    onkeydown={(e) => onOptionKeydown(e, entry)}
  >
    <span class="font-bold text-gray-800">{entry.number}.</span>
    <div class="flex flex-col gap-0.5 flex-1">
      <span class="text-sm text-gray-800">{entry.displayClue}</span>
      {#if entry.isChainHead && entry.lengthPattern !== null}
        <span class="text-xs text-gray-500">({entry.lengthPattern})</span>
      {/if}
    </div>
  </li>
{/snippet}

<aside bind:this={panelEl} class="flex w-full max-w-md flex-col gap-4 max-h-[70vh] overflow-y-auto">
  <ul role="listbox" aria-label="Clues" class="flex flex-col gap-4">
    <li role="group" aria-label="Across clues">
      <h2 class="text-sm font-semibold text-gray-700">Across</h2>
      <ul class="flex flex-col gap-1">
        {#each vm.across as entry (entry.id)}
          {@render clueRow(entry)}
        {/each}
      </ul>
    </li>
    <li role="group" aria-label="Down clues">
      <h2 class="text-sm font-semibold text-gray-700">Down</h2>
      <ul class="flex flex-col gap-1">
        {#each vm.down as entry (entry.id)}
          {@render clueRow(entry)}
        {/each}
      </ul>
    </li>
  </ul>
</aside>
