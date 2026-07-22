<script lang="ts">
  import type { DisplacedCluesPanelVM } from '../bindings/viewmodels/builderVM';
  import { dispatchBuilder } from '../bindings/builderStore.svelte';

  let { vm }: { vm: DisplacedCluesPanelVM } = $props();
</script>

{#if vm.visible === true}
  <aside class="rounded border border-gray-200 p-3">
    <h2 class="text-sm font-semibold text-gray-700 mb-2">Displaced clues</h2>
    {#if vm.entries.length === 0}
      <p class="text-xs text-gray-400 italic">{vm.emptyMessage}</p>
    {:else}
      <ul class="flex flex-col gap-2">
        {#each vm.entries as entry}
          <li class="flex flex-col gap-1 rounded p-2 {entry.isBeingReattached ? 'ring-2 ring-amber-400' : 'bg-gray-50'}">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-gray-500 uppercase">{entry.direction}</span>
              <span class="text-sm text-gray-800 flex-1">{entry.clue || '(empty)'}</span>
            </div>
            <div class="flex gap-2">
              <button class="text-xs text-blue-600 underline"
                      onclick={() => dispatchBuilder({ kind: 'begin-reattach', displacedClueId: entry.id })}>Reattach</button>
              <button class="text-xs text-red-600 underline"
                      onclick={() => dispatchBuilder({ kind: 'delete-displaced-clue', id: entry.id })}>Delete</button>
              {#if entry.isBeingReattached}
                <span class="text-xs text-amber-700">(Reattaching…)</span>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </aside>
{/if}
