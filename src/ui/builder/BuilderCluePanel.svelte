<script lang="ts">
  import type { CluePanelVM, ClueEntryVM } from '../bindings/viewmodels/cluePanelVM';
  import { dispatchBuilder } from '../bindings/builderStore.svelte';

  let { vm }: { vm: CluePanelVM } = $props();

  const drafts = $state(new Map<string, string>());

  const isInJoinMode = $derived(
    vm.across.some((entry) => entry.isLinkableFromJoinSource) ||
      vm.down.some((entry) => entry.isLinkableFromJoinSource),
  );

  function canonicalId(wordKey: ClueEntryVM['wordKey']): string {
    return `${wordKey.startRow}_${wordKey.startCol}_${wordKey.direction}`;
  }

  function rowId(entry: ClueEntryVM): string {
    return `${entry.direction}-${Number(entry.number)}`;
  }

  function draftFor(wordKey: ClueEntryVM['wordKey'], displayClue: string): string {
    const id = canonicalId(wordKey);
    if (!drafts.has(id)) {
      drafts.set(id, displayClue);
    }
    return drafts.get(id) ?? displayClue;
  }

  function setDraft(wordKey: ClueEntryVM['wordKey'], value: string): void {
    drafts.set(canonicalId(wordKey), value);
  }

  function dispatchEditClue(entry: ClueEntryVM): void {
    dispatchBuilder({
      kind: 'edit-clue',
      wordKey: entry.wordKey,
      clue: draftFor(entry.wordKey, entry.displayClue),
    });
  }

  function dispatchBeginJoin(entry: ClueEntryVM): void {
    dispatchBuilder({ kind: 'begin-join', source: entry.wordKey });
  }

  function dispatchUnjoin(entry: ClueEntryVM): void {
    dispatchBuilder({ kind: 'unjoin', source: entry.wordKey });
  }

  function dispatchRowClick(entry: ClueEntryVM): void {
    dispatchBuilder({ kind: 'click-clue-panel-word', wordKey: entry.wordKey });
    (document.getElementById('typing-surface-input') as HTMLInputElement | null)?.focus();
  }

  function stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  $effect(() => {
    const key = vm.highlightedWordKey;
    if (key === null) return;

    const targetCanonical = canonicalId(key);
    for (const entry of vm.across) {
      if (canonicalId(entry.wordKey) === targetCanonical) {
        document.getElementById(rowId(entry))?.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
    for (const entry of vm.down) {
      if (canonicalId(entry.wordKey) === targetCanonical) {
        document.getElementById(rowId(entry))?.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
  });
</script>

<aside class="flex w-full max-w-md flex-col gap-4">
  <section>
    <h2 class="text-sm font-semibold text-gray-700">Across</h2>
    <ul class="flex flex-col gap-1">
      {#each vm.across as entry (canonicalId(entry.wordKey))}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <li
          id={rowId(entry)}
          class="flex items-start gap-2 rounded p-1 cursor-pointer {entry.isSelected
            ? 'bg-yellow-100'
            : ''} {entry.isLinkableFromJoinSource ? 'ring-2 ring-blue-400' : ''}"
          onclick={() => dispatchRowClick(entry)}
        >
          <span class="font-bold text-gray-800">{Number(entry.number)}</span>
          <span class="text-xs font-semibold text-gray-500 uppercase">{entry.direction === 'across' ? 'A' : 'D'}</span>

          {#if entry.isChainHead}
            <div class="flex flex-1 flex-col gap-1">
              <input
                type="text"
                class="rounded border border-gray-300 px-2 py-1 text-sm"
                value={draftFor(entry.wordKey, entry.displayClue)}
                oninput={(e) => setDraft(entry.wordKey, e.currentTarget.value)}
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
      {/each}
    </ul>
  </section>

  <section>
    <h2 class="text-sm font-semibold text-gray-700">Down</h2>
    <ul class="flex flex-col gap-1">
      {#each vm.down as entry (canonicalId(entry.wordKey))}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <li
          id={rowId(entry)}
          class="flex items-start gap-2 rounded p-1 cursor-pointer {entry.isSelected
            ? 'bg-yellow-100'
            : ''} {entry.isLinkableFromJoinSource ? 'ring-2 ring-blue-400' : ''}"
          onclick={() => dispatchRowClick(entry)}
        >
          <span class="font-bold text-gray-800">{Number(entry.number)}</span>
          <span class="text-xs font-semibold text-gray-500 uppercase">{entry.direction === 'across' ? 'A' : 'D'}</span>

          {#if entry.isChainHead}
            <div class="flex flex-1 flex-col gap-1">
              <input
                type="text"
                class="rounded border border-gray-300 px-2 py-1 text-sm"
                value={draftFor(entry.wordKey, entry.displayClue)}
                oninput={(e) => setDraft(entry.wordKey, e.currentTarget.value)}
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
      {/each}
    </ul>
  </section>
</aside>
