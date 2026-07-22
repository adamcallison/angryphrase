<script lang="ts">
  import type { ActiveClueBannerVM } from '../bindings/viewmodels/playerVM';

  let { vm }: { vm: ActiveClueBannerVM } = $props();
</script>

<div class="min-h-[3rem] flex items-center gap-3 rounded border border-gray-200 bg-gray-50 px-4 py-2 text-gray-800">
  {#if vm.wordNumber === null || vm.direction === null || vm.displayClue === null}
    <span class="text-sm text-gray-400 italic">Select a cell or clue to see the active clue.</span>
  {:else}
    <span class="font-bold text-lg">{Number(vm.wordNumber)}</span>
    <span class="text-xs uppercase tracking-wide text-gray-500">{vm.direction}</span>
    <span class="flex-1 text-sm">{vm.displayClue}</span>
    {#if vm.lengthPattern !== null}
      <span class="text-xs text-gray-500">({vm.lengthPattern})</span>
    {/if}
  {/if}
</div>
