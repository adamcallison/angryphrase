<script lang="ts">
  import { parseGridSizeDraft } from './helpers/gridSizeInput';

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

  let draft = $state<string | null>(null);

  function onBlur(): void {
    const n = parseGridSizeDraft(draft);
    if (n !== null) {
      onCommit(n);
    }
    draft = null;
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
    value={draft ?? value}
    {disabled}
    oninput={(e) => {
      draft = e.currentTarget.value;
    }}
    onblur={onBlur}
    class="w-16 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus-ring"
  />
  {#if disabled}
    <span class="text-xs text-gray-500">Disabled — clear the grid first.</span>
  {/if}
</div>
