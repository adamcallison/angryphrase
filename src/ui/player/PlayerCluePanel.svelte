<script lang="ts">
  import type { CluePanelVM } from '../bindings/viewmodels/cluePanelVM';
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
</script>

<aside bind:this={panelEl} class="flex w-full max-w-md flex-col gap-4 max-h-[70vh] overflow-y-auto">
  <section>
    <h2 class="text-sm font-semibold text-gray-700">Across</h2>
    <ul class="flex flex-col gap-1">
      {#each vm.across as entry (entry.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li
          bind:this={liRefs[entry.id]}
          class="flex items-start gap-2 rounded p-1 cursor-pointer {entry.isSelected ? 'bg-yellow-100' : ''}"
          onclick={() => {
            actions.clickCluePanelWord(entry.wordKey);
          }}
        >
          <span class="font-bold text-gray-800">{entry.number}.</span>
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
      {#each vm.down as entry (entry.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li
          bind:this={liRefs[entry.id]}
          class="flex items-start gap-2 rounded p-1 cursor-pointer {entry.isSelected ? 'bg-yellow-100' : ''}"
          onclick={() => {
            actions.clickCluePanelWord(entry.wordKey);
          }}
        >
          <span class="font-bold text-gray-800">{entry.number}.</span>
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
