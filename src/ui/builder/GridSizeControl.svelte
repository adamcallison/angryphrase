<script lang="ts">
  import { parseGridSizeDraft } from './gridSizeInput';

  let {
    value,
    min,
    max,
    disabled,
    onCommit,
  }: {
    value: number;
    min: number;
    max: number;
    disabled: boolean;
    onCommit: (newValue: number) => boolean;
  } = $props();

  // svelte-ignore state_referenced_locally
  let draft = $state<number | null>(value);
  $effect(() => {
    draft = value;
  });

  function onBlur(): void {
    const n = parseGridSizeDraft(draft);
    if (n === null) {
      draft = value;
      return;
    }
    const accepted = onCommit(n);
    if (!accepted) {
      draft = value;
    }
  }
</script>

<div class="flex items-center gap-2">
  <label for="grid-size" class="text-sm text-gray-700">Grid size:</label>
  <input
    id="grid-size"
    type="number"
    {min}
    {max}
    step="1"
    bind:value={draft}
    {disabled}
    onblur={onBlur}
    class="w-16 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
  />
  {#if disabled}
    <span class="text-xs text-gray-500">Disabled — clear the grid first.</span>
  {/if}
</div>
