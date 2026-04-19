<script lang="ts">
  let {
    gridSize,
    isBlank,
    onSizeChange,
  }: {
    gridSize: number;
    isBlank: boolean;
    onSizeChange: (newSize: number) => void;
  } = $props();

  function handleChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 2) {
      onSizeChange(value);
    }
  }
</script>

<div class="flex flex-col gap-1">
  <label for="grid-size" class="text-sm font-medium text-gray-700"
    >Grid Size</label
  >
  <div class="flex items-center gap-2">
    <input
      id="grid-size"
      type="number"
      min="2"
      class="w-16 border border-gray-300 rounded px-2 py-1.5 text-sm text-center
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        {!isBlank ? 'bg-gray-100 cursor-not-allowed' : ''}"
      value={gridSize}
      disabled={!isBlank}
      onchange={handleChange}
    />
    <span class="text-sm text-gray-600">×{gridSize}</span>
  </div>
  {#if !isBlank}
    <p class="text-xs text-gray-400">
      Grid size can only be changed when the grid is blank.
    </p>
  {/if}
</div>