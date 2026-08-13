<script lang="ts">
  import type { CluePanelVM, ClueEntryVM } from '../bindings/viewmodels/cluePanelVM';
  import ClueSection from './ClueSection.svelte';

  let { vm }: { vm: CluePanelVM } = $props();

  let panelEl: HTMLElement | null = $state(null);

  const isInJoinMode = $derived(
    vm.across.some((entry) => entry.isLinkableFromJoinSource) ||
      vm.down.some((entry) => entry.isLinkableFromJoinSource),
  );

  function rowId(entry: ClueEntryVM): string {
    return `${entry.direction}-${Number(entry.number)}`;
  }

  $effect(() => {
    const key = vm.highlightedWordKey;
    if (key === null) return;
    for (const entry of [...vm.across, ...vm.down]) {
      if (key.startRow === entry.wordKey.startRow &&
          key.startCol === entry.wordKey.startCol &&
          key.direction === entry.wordKey.direction) {
        const el = document.getElementById(rowId(entry));
        if (panelEl !== null && el !== null) {
          panelEl.scrollTop += el.getBoundingClientRect().top - panelEl.getBoundingClientRect().top;
        }
        return;
      }
    }
  });
</script>

<aside bind:this={panelEl} class="flex w-full max-w-md flex-col gap-4 max-h-[70vh] overflow-y-auto">
  <ClueSection title="Across" entries={vm.across} isInJoinMode={isInJoinMode} />
  <ClueSection title="Down" entries={vm.down} isInJoinMode={isInJoinMode} />
</aside>
