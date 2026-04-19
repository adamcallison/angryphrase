<script lang="ts">
  let { onBuild, onPlay }: { onBuild: () => void; onPlay: () => void } = $props();
</script>

<div class="min-h-screen flex flex-col items-center justify-center bg-slate-50">
  <h1 class="text-4xl font-bold text-slate-900 mb-2">Crossword Builder & Player</h1>
  <p class="text-slate-500 mb-10">Create and solve crossword puzzles</p>
  <div class="flex gap-6">
    <button
      class="px-10 py-5 text-xl font-semibold rounded-xl bg-blue-600 text-white shadow-lg
        hover:bg-blue-700 transition-colors cursor-pointer"
      onclick={onBuild}
    >
      Build
    </button>
    <button
      class="px-10 py-5 text-xl font-semibold rounded-xl bg-emerald-600 text-white shadow-lg
        hover:bg-emerald-700 transition-colors cursor-pointer"
      onclick={onPlay}
    >
      Play
    </button>
  </div>
</div>