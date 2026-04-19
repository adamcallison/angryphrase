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

<div class="mode-toggle">
  <button
    type="button"
    class="mode-btn mode-btn--left {mode === 'design' ? 'mode-btn--active' : 'mode-btn--inactive'}"
    onclick={() => handleSwitch("design")}
  >
    Design
  </button>
  <button
    type="button"
    class="mode-btn mode-btn--right {mode === 'fill' ? 'mode-btn--active' : 'mode-btn--inactive'}"
    onclick={() => handleSwitch("fill")}
  >
    Fill
  </button>
</div>

<style>
  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem; /* gap-1 */
  }

  .mode-btn {
    padding: 0.375rem 1rem; /* py-1.5 px-4 */
    font-size: 0.875rem; /* text-sm */
    font-weight: 500; /* font-medium */
    border: 1px solid #d1d5db; /* gray-300 */
    transition: colors 0.15s;
    cursor: pointer;
  }

  .mode-btn--left {
    border-radius: 0.375rem 0 0 0.375rem; /* rounded-l-md */
  }

  .mode-btn--right {
    border-radius: 0 0.375rem 0.375rem 0; /* rounded-r-md */
  }

  .mode-btn--active {
    background: #2563eb; /* blue-600 */
    color: white;
    border-color: #2563eb; /* blue-600 */
  }

  .mode-btn--inactive {
    background: white;
    color: #374151; /* gray-700 */
  }

  .mode-btn--inactive:hover {
    background: #f9fafb; /* gray-50 */
  }
</style>