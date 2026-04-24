<script lang="ts">
  let {
    isBlack,
    letter,
    number,
    isSelected,
    isHighlighted,
    spaceRight,
    spaceBottom,
    hyphenRight,
    hyphenBottom,
    onclick,
  }: {
    isBlack: boolean;
    letter: string | null;
    number: number | null;
    isSelected: boolean;
    isHighlighted: boolean;
    spaceRight: boolean;
    spaceBottom: boolean;
    hyphenRight: boolean;
    hyphenBottom: boolean;
    onclick: () => void;
  } = $props()
</script>

{#if isBlack}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="cell cell--black" role="gridcell" onclick={onclick}></div>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="cell cell--white {isSelected ? 'cell--selected' : isHighlighted ? 'cell--highlighted' : 'cell--default'}"
    role="gridcell"
    onclick={onclick}
  >
    {#if number !== null}
      <span class="cell-number">{number}</span>
    {/if}
    {#if letter !== null}
      <span class="cell-letter">{letter}</span>
    {/if}
    {#if spaceRight}
      <div class="cell-marker cell-marker--right"></div>
    {/if}
    {#if spaceBottom}
      <div class="cell-marker cell-marker--bottom"></div>
    {/if}
    {#if hyphenRight}
      <span class="cell-hyphen cell-hyphen--right">-</span>
    {/if}
    {#if hyphenBottom}
      <span class="cell-hyphen cell-hyphen--bottom">-</span>
    {/if}
  </div>
{/if}

<style>
  .cell {
    width: var(--cell-size);
    height: var(--cell-size);
    box-sizing: border-box;
  }

  .cell--black {
    background: black;
    border: 1px solid #374151; /* gray-700 */
  }

  .cell--white {
    position: relative;
    border: 1px solid #d1d5db; /* gray-300 */
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
  }

  .cell--selected {
    background: #fde047; /* yellow-300 */
  }

  .cell--highlighted {
    background: #fef3c7; /* yellow-100 */
  }

  .cell--default {
    background: white;
  }

  .cell-number {
    position: absolute;
    top: 1px;
    left: 2px;
    font-size: var(--cell-number-size);
    line-height: 1;
    color: #4b5563; /* gray-600 */
    user-select: none;
    pointer-events: none;
  }

  .cell-letter {
    font-size: 1.125rem; /* text-lg */
    font-weight: 700;
    user-select: none;
    pointer-events: none;
  }

  .cell-marker {
    position: absolute;
    pointer-events: none;
  }

  .cell-marker--right {
    top: 0;
    bottom: 0;
    right: 0;
    width: var(--cell-marker-width);
    background: #374151; /* gray-700 */
  }

  .cell-marker--bottom {
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--cell-marker-width);
    background: #374151; /* gray-700 */
  }

  .cell-hyphen {
    position: absolute;
    font-size: var(--cell-hyphen-size);
    line-height: 1;
    color: #4b5563; /* gray-600 */
    font-weight: 700;
    user-select: none;
    pointer-events: none;
  }

  .cell-hyphen--right {
    top: 50%;
    right: 1px;
    transform: translateY(-50%);
  }

  .cell-hyphen--bottom {
    left: 50%;
    bottom: 1px;
    transform: translateX(-50%);
  }
</style>