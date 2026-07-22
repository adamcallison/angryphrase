<script lang="ts">
  import { dispatch } from '../bindings/appStore.svelte';

  function goToBuild(): void {
    dispatch({ kind: 'navigate', route: 'build' });
  }

  function goToPlay(): void {
    dispatch({ kind: 'navigate', route: 'play' });
  }
</script>

<main class="mx-auto flex max-w-3xl flex-col items-center gap-12 px-4 py-16">
  <p class="text-lg text-gray-700">What would you like to do?</p>
  <div class="flex w-full max-w-md gap-6">
    <button
      type="button"
      class="flex-1 rounded-md bg-blue-600 px-6 py-12 text-white text-xl font-bold hover:bg-blue-700"
      onclick={goToBuild}>
      Build
    </button>
    <button
      type="button"
      class="flex-1 rounded-md bg-green-600 px-6 py-12 text-white text-xl font-bold hover:bg-green-700"
      onclick={goToPlay}>
      Play
    </button>
  </div>
</main>
