<script lang="ts">
  let {
    onCheck,
    onReset,
    onImportNew,
    puzzleLoaded,
  }: {
    onCheck: () => void;
    onReset: () => void;
    onImportNew: () => void;
    puzzleLoaded: boolean;
  } = $props();
</script>

<div class="flex flex-wrap gap-2">
  <button
    class="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white
      hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
      focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed
      disabled:hover:bg-blue-600"
    onclick={onCheck}
    disabled={!puzzleLoaded}
  >
    Check
  </button>
  <button
    class="px-4 py-2 text-sm font-medium rounded bg-gray-200 text-gray-700
      hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400
      focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed
      disabled:hover:bg-gray-200"
    onclick={onReset}
    disabled={!puzzleLoaded}
  >
    Reset
  </button>
  <button
    class="px-4 py-2 text-sm font-medium rounded bg-gray-200 text-gray-700
      hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400
      focus:ring-offset-1"
    onclick={onImportNew}
  >
    Import New Puzzle
  </button>
</div>