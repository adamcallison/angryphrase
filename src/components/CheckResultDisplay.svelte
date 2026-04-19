<script lang="ts">
  import type { CheckResult } from "$lib/types";

  let {
    checkResult,
    onClearErrors,
  }: {
    checkResult: CheckResult | null;
    onClearErrors: () => void;
  } = $props();

  /** Message and styling derived from the check result type. */
  let resultConfig = $derived.by(() => {
    if (checkResult === null) {
      return null;
    }

    switch (checkResult.type) {
      case "complete-correct":
        return {
          message: "Congratulations! The puzzle is complete and correct!",
          bgClass: "bg-green-50 border-green-300",
          textClass: "text-green-800",
          showClearButton: false,
        };
      case "incomplete-correct":
        return {
          message: "So far, so good! Everything filled in is correct.",
          bgClass: "bg-blue-50 border-blue-300",
          textClass: "text-blue-800",
          showClearButton: false,
        };
      case "complete-incorrect":
        return {
          message: "The puzzle is complete but has errors.",
          bgClass: "bg-amber-50 border-amber-300",
          textClass: "text-amber-800",
          showClearButton: true,
        };
      case "incomplete-incorrect":
        return {
          message: "There are some errors.",
          bgClass: "bg-amber-50 border-amber-300",
          textClass: "text-amber-800",
          showClearButton: true,
        };
    }
  });
</script>

{#if resultConfig !== null}
  <div class="rounded-lg border p-4 {resultConfig.bgClass}">
    <p class="font-medium {resultConfig.textClass}">
      {resultConfig.message}
    </p>
    {#if resultConfig.showClearButton}
      <button
        class="mt-2 px-4 py-1.5 text-sm font-medium rounded bg-white border
          border-gray-300 text-gray-700 hover:bg-gray-100
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        onclick={onClearErrors}
      >
        Clear Errors
      </button>
    {/if}
  </div>
{:else}
  <p class="text-gray-400 text-sm py-2">Click Check to verify your answers.</p>
{/if}