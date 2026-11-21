<script lang="ts">
  import type { CluePanelVM, ClueEntryVM } from '../bindings/viewmodels/cluePanelVM';
  import type { BuilderCluePanelActions } from '../bindings/builderFacade';
  import { SvelteMap } from 'svelte/reactivity';
  import CluePanelShell from '../shared/CluePanelShell.svelte';

  let {
    vm,
    actions,
    registerTabOut,
  }: {
    vm: CluePanelVM;
    actions: BuilderCluePanelActions;
    registerTabOut: (fn: () => boolean) => void;
  } = $props();

  const isInJoinMode = $derived(
    vm.across.some((entry) => entry.isLinkableFromJoinSource) ||
      vm.down.some((entry) => entry.isLinkableFromJoinSource),
  );

  const drafts = new SvelteMap<string, string>();

  // Per-row editor refs, keyed by the same entry ids the shell's liRefs use.
  // Svelte 5 nulls a bind:this on unmount, so a stale id may map to null;
  // the Tab-out handler guards both absent and unmounted cases. Non-head
  // rows have no input — their ids simply never appear here.
  const inputRefs: Record<string, HTMLInputElement | null> = $state({});

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

  // Registered once at component init (plain top-level call, no $effect):
  // the shell holds the function in a non-reactive slot and offers it to the
  // typing surface on plain Tab. Reading `vm.highlightedId` at CALL time is
  // load-bearing — the closure over the `vm` prop binding is live in
  // Svelte 5, so this always sees the row the user last clicked, never the
  // row selected at registration. A false return (no selection, or the
  // selected row has no editor) falls through to the default Tab walk — the
  // contract with TypingSurface. The wrapper only exists so the prop is
  // referenced inside a closure (state_referenced_locally) — it is invoked
  // exactly once, synchronously, at component init.
  function registerTabOutHandler(): void {
    registerTabOut(() => {
      const id = vm.highlightedId;
      if (id === null) return false;
      const el = inputRefs[id];
      if (el === undefined || el === null) return false;
      el.focus();
      return true;
    });
  }
  registerTabOutHandler();
</script>

<CluePanelShell highlightedId={vm.highlightedId}>
  {#snippet children(liRefs)}
    {#snippet clueRow(entry: ClueEntryVM)}
      <li
        bind:this={liRefs[entry.id]}
        class="relative flex items-start gap-2 rounded p-1 {entry.isSelected
          ? 'bg-hilite-word'
          : ''} {entry.isLinkableFromJoinSource ? 'ring-2 ring-accent-join' : ''}"
      >
        <button
          type="button"
          tabindex="-1"
          class="absolute inset-0 rounded cursor-pointer"
          aria-label={entry.selectLabel}
          onclick={() => dispatchRowClick(entry)}
        ></button>
        <span class="relative font-bold text-gray-800">{entry.number}</span>
        <span class="relative text-xs font-semibold text-gray-500 uppercase">{entry.direction === 'across' ? 'A' : 'D'}</span>

        {#if entry.isChainHead}
          <div class="relative flex flex-1 flex-col gap-1">
            <input
              type="text"
              class="rounded border border-gray-300 px-2 py-1 text-sm focus-ring"
              bind:this={inputRefs[entry.id]}
              value={valueFor(entry.id, entry.displayClue)}
              oninput={(e) => setDraft(entry.id, e.currentTarget.value)}
              onblur={() => dispatchEditClue(entry)}
            />
            {#if entry.lengthPattern !== null}
              <span class="relative text-xs text-gray-500">({entry.lengthPattern})</span>
            {/if}
            <div class="relative flex gap-2">
              {#if entry.isStartableJoinSource && !isInJoinMode}
                <button
                  type="button"
                  class="link text-primary"
                  onclick={() => dispatchBeginJoin(entry)}
                >
                  Link next
                </button>
              {/if}
              {#if entry.isUnjoinable}
                <button
                  type="button"
                  class="link text-danger"
                  onclick={() => dispatchUnjoin(entry)}
                >
                  Unlink
                </button>
              {/if}
            </div>
          </div>
        {:else}
          <span class="relative flex-1 text-sm italic text-gray-700">{entry.displayClue}</span>
        {/if}
      </li>
    {/snippet}

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
  {/snippet}
</CluePanelShell>
