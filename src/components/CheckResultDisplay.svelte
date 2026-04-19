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
          variant: "success",
          showClearButton: false,
        };
      case "incomplete-correct":
        return {
          message: "So far, so good! Everything filled in is correct.",
          variant: "info",
          showClearButton: false,
        };
      case "complete-incorrect":
        return {
          message: "The puzzle is complete but has errors.",
          variant: "warning",
          showClearButton: true,
        };
      case "incomplete-incorrect":
        return {
          message: "There are some errors.",
          variant: "warning",
          showClearButton: true,
        };
    }
  });
</script>

{#if resultConfig !== null}
  <div class="check-result check-result--{resultConfig.variant}">
    <p class="check-result__message">
      {resultConfig.message}
    </p>
    {#if resultConfig.showClearButton}
      <button
        class="check-result__clear-btn"
        onclick={onClearErrors}
      >
        Clear Errors
      </button>
    {/if}
  </div>
{:else}
  <p class="check-result__hint">Click Check to verify your answers.</p>
{/if}

<style>
  .check-result {
    border-radius: 0.5rem; /* rounded-lg */
    border: 1px solid transparent;
    padding: 1rem; /* p-4 */
  }

  .check-result--success {
    background: #f0fdf4; /* green-50 */
    border-color: #86efac; /* green-300 */
  }

  .check-result--success .check-result__message {
    color: #166534; /* green-800 */
  }

  .check-result--info {
    background: #eff6ff; /* blue-50 */
    border-color: #93c5fd; /* blue-300 */
  }

  .check-result--info .check-result__message {
    color: #1e40af; /* blue-800 */
  }

  .check-result--warning {
    background: #fffbeb; /* amber-50 */
    border-color: #fcd34d; /* amber-300 */
  }

  .check-result--warning .check-result__message {
    color: #92400e; /* amber-800 */
  }

  .check-result__message {
    font-weight: 500; /* font-medium */
  }

  .check-result__clear-btn {
    margin-top: 0.5rem; /* mt-2 */
    padding: 0.375rem 1rem; /* py-1.5 px-4 */
    font-size: 0.875rem; /* text-sm */
    font-weight: 500; /* font-medium */
    border-radius: 0.25rem; /* rounded */
    background: white;
    border: 1px solid #d1d5db; /* gray-300 */
    color: #374151; /* gray-700 */
    cursor: pointer;
  }

  .check-result__clear-btn:hover {
    background: #f3f4f6; /* gray-100 */
  }

  .check-result__clear-btn:focus {
    outline: none;
    box-shadow: 0 0 0 2px #3b82f6; /* ring-2 ring-blue-500 */
    outline-offset: 1px;
  }

  .check-result__hint {
    color: #9ca3af; /* gray-400 */
    font-size: 0.875rem; /* text-sm */
    padding: 0.5rem 0; /* py-2 */
  }
</style>