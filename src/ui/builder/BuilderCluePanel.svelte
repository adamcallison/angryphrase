<script lang="ts">
  import type { CluePanelVM, ClueEntryVM } from '../bindings/viewmodels/cluePanelVM';
  import type { BuilderCluePanelActions } from '../bindings/builderFacade';
  import { SvelteMap } from 'svelte/reactivity';
  import { scrollRowIntoView } from '../shared/clueScroll';

  let { vm, actions }: { vm: CluePanelVM; actions: BuilderCluePanelActions } = $props();

  let panelEl: HTMLElement | null = $state(null);

  const isInJoinMode = $derived(
    vm.across.some((entry) => entry.isLinkableFromJoinSource) ||
      vm.down.some((entry) => entry.isLinkableFromJoinSource),
  );

  const drafts = new SvelteMap<string, string>();

  function valueFor(id: string, displayClue: string): string {
    if (!drafts.has(id)) return displayClue;
    const draft = drafts.get(id);
    return draft === undefined ? displayClue : draft;
  }

  function setDraft(id: string, value: string): void {
    drafts.set(id, value);
  }

  function clearDraft(id: string): void {
    drafts.delete(id);
  }

  function dispatchEditClue(entry: ClueEntryVM): void {
    const clue = !drafts.has(entry.id)
      ? entry.displayClue
      : drafts.get(entry.id) ?? entry.displayClue;
    actions.editClue(entry.wordKey, clue);
    clearDraft(entry.id);
  }

  function dispatchBeginJoin(entry: ClueEntryVM): void {
    actions.beginJoin(entry.wordKey);
  }

  function dispatchUnjoin(entry: ClueEntryVM): void {
    actions.unjoin(entry.wordKey);
  }

  function dispatchRowClick(entry: ClueEntryVM): void {
    actions.clickCluePanelWord(entry.wordKey);
  }

  function stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  let liRefs: Record<string, HTMLElement> = $state({});

  $effect(() => {
    const id = vm.highlightedId;
    if (id === null) return;
    scrollRowIntoView(panelEl, liRefs, id);
  });
</script>

{#snippet clueRow(entry: ClueEntryVM)}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <li
    bind:this={liRefs[entry.id]}
    class="flex items-start gap-2 rounded p-1 cursor-pointer {entry.isSelected
      ? 'bg-yellow-100'
      : ''} {entry.isLinkableFromJoinSource ? 'ring-2 ring-blue-400' : ''}"
    onclick={() => dispatchRowClick(entry)}
  >
    <span class="font-bold text-gray-800">{entry.number}</span>
    <span class="text-xs font-semibold text-gray-500 uppercase">{entry.direction === 'across' ? 'A' : 'D'}</span>

    {#if entry.isChainHead}
      <div class="flex flex-1 flex-col gap-1">
        <input
          type="text"
          class="rounded border border-gray-300 px-2 py-1 text-sm"
          value={valueFor(entry.id, entry.displayClue)}
          oninput={(e) => setDraft(entry.id, e.currentTarget.value)}
          onblur={() => dispatchEditClue(entry)}
          onclick={(e) => stopPropagation(e)}
        />
        {#if entry.lengthPattern !== null}
          <span class="text-xs text-gray-500">({entry.lengthPattern})</span>
        {/if}
        <div class="flex gap-2">
          {#if entry.isStartableJoinSource && !isInJoinMode}
            <button
              class="text-xs text-blue-600 underline"
              onclick={(e) => {
                stopPropagation(e);
                dispatchBeginJoin(entry);
              }}
            >
              Link next
            </button>
          {/if}
          {#if entry.isUnjoinable}
            <button
              class="text-xs text-red-600 underline"
              onclick={(e) => {
                stopPropagation(e);
                dispatchUnjoin(entry);
              }}
            >
              Unlink
            </button>
          {/if}
        </div>
      </div>
    {:else}
      <span class="flex-1 text-sm italic text-gray-700">{entry.displayClue}</span>
    {/if}
  </li>
{/snippet}

<aside bind:this={panelEl} class="flex w-full max-w-md flex-col gap-4 max-h-[70vh] overflow-y-auto">
  <section>
    <h2 class="text-sm font-semibold text-gray-700">Across</h2>
    <ul class="flex flex-col gap-1">
      {#each vm.across as entry (entry.id)}
        {@render clueRow(entry)}
      {/each}
    </ul>
  </section>
  <section>
    <h2 class="text-sm font-semibold text-gray-700">Down</h2>
    <ul class="flex flex-col gap-1">
      {#each vm.down as entry (entry.id)}
        {@render clueRow(entry)}
      {/each}
    </ul>
  </section>
</aside>
