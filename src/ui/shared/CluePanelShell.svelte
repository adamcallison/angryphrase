<script lang="ts">
  import type { Snippet } from 'svelte';
  import { scrollRowIntoView } from './clueScroll';

  let {
    highlightedId,
    children,
  }: { highlightedId: string | null; children: Snippet<[Record<string, HTMLElement>]> } = $props();

  let panelEl: HTMLElement | null = $state(null);

  const liRefs: Record<string, HTMLElement> = $state({});

  $effect(() => {
    if (highlightedId === null) return;
    scrollRowIntoView(panelEl, liRefs, highlightedId);
  });
</script>

<aside bind:this={panelEl} class="flex w-full max-w-md flex-col gap-4 max-h-[70vh] overflow-y-auto">
  {@render children(liRefs)}
</aside>
