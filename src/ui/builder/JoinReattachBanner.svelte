<script lang="ts">
  import type { BuilderSubModeBannerVM } from '../bindings/viewmodels/builderVM';
  import { dispatchEscape } from '../bindings/builderStore.svelte';

  let { vm }: { vm: BuilderSubModeBannerVM } = $props();
</script>

{#if vm.kind === 'join'}
  <div class="rounded bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-center justify-between gap-4">
    <div class="flex-1">
      <strong>Join sub-mode:</strong>
      Click the next clue-list entry to link it after #{Number(vm.sourceNumber)} {vm.sourceDirection}.
      Press Escape or click Cancel to abort.
    </div>
    <button class="text-xs text-blue-700 underline" onclick={() => dispatchEscape()}>Cancel</button>
  </div>
{:else if vm.kind === 'reattach'}
  <div class="rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex items-center justify-between gap-4">
    <div class="flex-1">
      <strong>Reattach sub-mode (direction: {vm.clueDirection}):</strong>
      Beginning to rehome "{vm.cluePreview}". Click a <em>clue list</em> target that is a chain head with an empty clue.
      Press Escape or click Cancel to abort.
    </div>
    <button class="text-xs text-amber-800 underline" onclick={() => dispatchEscape()}>Cancel</button>
  </div>
{/if}
