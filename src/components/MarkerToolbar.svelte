<script lang="ts">
  import type { CellData } from "../lib/types";

  type MarkerName =
    | "spaceRight"
    | "spaceBottom"
    | "hyphenRight"
    | "hyphenBottom";

  let {
    cell,
    onToggleMarker,
  }: {
    cell: CellData | null;
    onToggleMarker: (marker: MarkerName) => void;
  } = $props();

  interface MarkerButton {
    name: MarkerName;
    label: string;
  }

  const markers: MarkerButton[] = [
    { name: "spaceRight", label: "Space Right" },
    { name: "spaceBottom", label: "Space Bottom" },
    { name: "hyphenRight", label: "Hyphen Right" },
    { name: "hyphenBottom", label: "Hyphen Bottom" },
  ];

  function isActive(marker: MarkerName): boolean {
    if (!cell) return false;
    return cell[marker] === true;
  }
</script>

<div class="marker-toolbar">
  {#each markers as marker (marker.name)}
    <button
      type="button"
      class="marker-btn {isActive(marker.name) ? 'marker-btn--active' : 'marker-btn--inactive'} {!cell ? 'marker-btn--disabled' : ''}"
      disabled={!cell}
      onclick={() => onToggleMarker(marker.name)}
    >
      {marker.label}
    </button>
  {/each}
</div>

<style>
  .marker-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem; /* gap-2 */
  }

  .marker-btn {
    padding: 0.375rem 0.75rem; /* py-1.5 px-3 */
    font-size: 0.75rem; /* text-xs */
    font-weight: 500; /* font-medium */
    border-radius: 0.25rem; /* rounded */
    border: 1px solid transparent;
    transition: colors 0.15s;
    cursor: pointer;
  }

  .marker-btn--active {
    background: #2563eb; /* blue-600 */
    color: white;
    border-color: #2563eb; /* blue-600 */
  }

  .marker-btn--inactive {
    background: white;
    color: #374151; /* gray-700 */
    border-color: #d1d5db; /* gray-300 */
  }

  .marker-btn--inactive:hover {
    background: #f9fafb; /* gray-50 */
  }

  .marker-btn--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>