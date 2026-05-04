import type { BuilderInteraction, InteractionEvent, PlayerInteraction, PlayerInteractionEvent } from "./types";

/**
 * Pure state transition function for the builder interaction state machine.
 *
 * Legal transitions:
 *   any        → design/fill  (switchMode — mode toggle)
 *   fill       → join          (startJoin)
 *   join       → fill          (finishJoin, cancel)
 *   fill       → reattach      (startReattach)
 *   reattach   → fill          (finishReattach, cancel, activeClueDeleted)
 *   reattach   → reattach      (clueIndexChanged — adjusts index)
 *
 * Returns the new state, or null if the transition is illegal.
 */
export function transitionBuilderInteraction(
  current: BuilderInteraction,
  event: InteractionEvent,
): BuilderInteraction | null {
  switch (event.kind) {
    case "switchMode":
      return { kind: event.mode };

    case "startJoin":
      if (current.kind !== "fill") return null;
      return { kind: "join", sourceWordId: event.sourceWordId };

    case "finishJoin":
      if (current.kind !== "join") return null;
      return { kind: "fill" };

    case "startReattach":
      if (current.kind !== "fill") return null;
      return { kind: "reattach", clueIndex: event.clueIndex };

    case "finishReattach":
      if (current.kind !== "reattach") return null;
      return { kind: "fill" };

    case "cancel":
      if (current.kind === "join" || current.kind === "reattach") {
        return { kind: "fill" };
      }
      return null;

    case "activeClueDeleted":
      if (current.kind !== "reattach") return null;
      return { kind: "fill" };

    case "clueIndexChanged":
      if (current.kind !== "reattach") return null;
      return { kind: "reattach", clueIndex: event.newIndex };
  }
}

/**
 * Pure state transition function for the player interaction state machine.
 *
 * States:
 *   noPuzzle — no puzzle is loaded; shows the import screen
 *   playing  — a puzzle is loaded; player is interacting with it
 *
 * Legal transitions:
 *   noPuzzle → playing  (importSuccess)
 *   playing  → noPuzzle (goToImport)
 */
export function transitionPlayerInteraction(
  current: PlayerInteraction,
  event: PlayerInteractionEvent,
): PlayerInteraction | null {
  switch (event.kind) {
    case "importSuccess":
      return { kind: "playing" };
    case "goToImport":
      if (current.kind !== "playing") return null;
      return { kind: "noPuzzle" };
  }
}