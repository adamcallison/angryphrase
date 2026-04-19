<script lang="ts">
  import type { Direction } from "$lib/types";

  let {
    clueNumber,
    clueDirection,
    clueText,
    wordLengthPattern,
  }: {
    clueNumber: number | null;
    clueDirection: Direction | null;
    clueText: string | null;
    wordLengthPattern: string | null;
  } = $props();

  const directionLabel: Record<Direction, string> = {
    across: "Across",
    down: "Down",
  };

  /** Whether a clue is currently selected. */
  let hasClue = $derived(
    clueNumber !== null && clueDirection !== null && clueText !== null
  );
</script>

{#if hasClue}
  <div class="text-lg font-semibold text-gray-900 px-1 py-2 break-words">
    {clueNumber} {directionLabel[clueDirection!]}{#if wordLengthPattern} <span class="font-normal text-gray-500">({wordLengthPattern})</span>{/if}: {clueText}
  </div>
{:else}
  <div class="py-2"></div>
{/if}