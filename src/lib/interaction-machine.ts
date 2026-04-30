import type { BuilderInteraction, InteractionEvent } from "./types";

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
export function transitionInteraction(
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