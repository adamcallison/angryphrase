<script lang="ts">
  let {
    mode,
    onModeChange,
  }: {
    mode: "design" | "fill";
    onModeChange: (newMode: "design" | "fill") => void;
  } = $props();

  function handleSwitch(newMode: "design" | "fill") {
    if (newMode === mode) return;
    onModeChange(newMode);
  }
</script>

<div class="flex items-center gap-1">
  <button
    type="button"
    class="px-4 py-1.5 text-sm font-medium rounded-l-md border border-gray-300 transition-colors
      {mode === 'design'
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-700 hover:bg-gray-50'}"
    onclick={() => handleSwitch("design")}
  >
    Design
  </button>
  <button
    type="button"
    class="px-4 py-1.5 text-sm font-medium rounded-r-md border border-gray-300 transition-colors
      {mode === 'fill'
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-700 hover:bg-gray-50'}"
    onclick={() => handleSwitch("fill")}
  >
    Fill
  </button>
</div>