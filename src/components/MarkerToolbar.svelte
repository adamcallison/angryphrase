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

<div class="flex items-center gap-2">
  {#each markers as marker (marker.name)}
    <button
      type="button"
      class="px-3 py-1.5 text-xs font-medium rounded border transition-colors
        {isActive(marker.name)
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}
        {!cell ? 'opacity-50 cursor-not-allowed' : ''}"
      disabled={!cell}
      onclick={() => onToggleMarker(marker.name)}
    >
      {marker.label}
    </button>
  {/each}
</div>