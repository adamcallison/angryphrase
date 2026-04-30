import { describe, it, expect } from "vitest";
import { transitionInteraction } from "./interaction-machine";
import type { BuilderInteraction, WordId } from "./types";

describe("transitionInteraction", () => {
  const designState: BuilderInteraction = { kind: "design" };
  const fillState: BuilderInteraction = { kind: "fill" };
  const joinState: BuilderInteraction = { kind: "join", sourceWordId: "0-0-across" as WordId };
  const reattachState: BuilderInteraction = { kind: "reattach", clueIndex: 2 };

  // === switchMode ===

  describe("switchMode", () => {
    it("transitions from design to fill", () => {
      const next = transitionInteraction(designState, { kind: "switchMode", mode: "fill" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("transitions from fill to design", () => {
      const next = transitionInteraction(fillState, { kind: "switchMode", mode: "design" });
      expect(next).toEqual({ kind: "design" });
    });

    it("transitions from join to design (cancels join)", () => {
      const next = transitionInteraction(joinState, { kind: "switchMode", mode: "design" });
      expect(next).toEqual({ kind: "design" });
    });

    it("transitions from reattach to fill (cancels reattach)", () => {
      const next = transitionInteraction(reattachState, { kind: "switchMode", mode: "fill" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("can switch to the same mode (idempotent)", () => {
      const next = transitionInteraction(fillState, { kind: "switchMode", mode: "fill" });
      expect(next).toEqual({ kind: "fill" });
    });
  });

  // === startJoin ===

  describe("startJoin", () => {
    it("transitions from fill to join", () => {
      const next = transitionInteraction(fillState, {
        kind: "startJoin",
        sourceWordId: "0-3-down" as WordId,
      });
      expect(next).toEqual({ kind: "join", sourceWordId: "0-3-down" });
    });

    it("rejects from design mode", () => {
      const next = transitionInteraction(designState, {
        kind: "startJoin",
        sourceWordId: "0-3-down" as WordId,
      });
      expect(next).toBeNull();
    });

    it("rejects from join mode (already joining)", () => {
      const next = transitionInteraction(joinState, {
        kind: "startJoin",
        sourceWordId: "0-3-down" as WordId,
      });
      expect(next).toBeNull();
    });

    it("rejects from reattach mode", () => {
      const next = transitionInteraction(reattachState, {
        kind: "startJoin",
        sourceWordId: "0-3-down" as WordId,
      });
      expect(next).toBeNull();
    });
  });

  // === finishJoin ===

  describe("finishJoin", () => {
    it("transitions from join to fill", () => {
      const next = transitionInteraction(joinState, { kind: "finishJoin" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("rejects from fill mode (not joining)", () => {
      const next = transitionInteraction(fillState, { kind: "finishJoin" });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionInteraction(designState, { kind: "finishJoin" });
      expect(next).toBeNull();
    });

    it("rejects from reattach mode", () => {
      const next = transitionInteraction(reattachState, { kind: "finishJoin" });
      expect(next).toBeNull();
    });
  });

  // === startReattach ===

  describe("startReattach", () => {
    it("transitions from fill to reattach", () => {
      const next = transitionInteraction(fillState, {
        kind: "startReattach",
        clueIndex: 3,
      });
      expect(next).toEqual({ kind: "reattach", clueIndex: 3 });
    });

    it("rejects from design mode", () => {
      const next = transitionInteraction(designState, {
        kind: "startReattach",
        clueIndex: 3,
      });
      expect(next).toBeNull();
    });

    it("rejects from join mode", () => {
      const next = transitionInteraction(joinState, {
        kind: "startReattach",
        clueIndex: 3,
      });
      expect(next).toBeNull();
    });

    it("rejects from reattach mode (already reattaching)", () => {
      const next = transitionInteraction(reattachState, {
        kind: "startReattach",
        clueIndex: 3,
      });
      expect(next).toBeNull();
    });
  });

  // === finishReattach ===

  describe("finishReattach", () => {
    it("transitions from reattach to fill", () => {
      const next = transitionInteraction(reattachState, { kind: "finishReattach" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("rejects from fill mode (not reattaching)", () => {
      const next = transitionInteraction(fillState, { kind: "finishReattach" });
      expect(next).toBeNull();
    });

    it("rejects from join mode", () => {
      const next = transitionInteraction(joinState, { kind: "finishReattach" });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionInteraction(designState, { kind: "finishReattach" });
      expect(next).toBeNull();
    });
  });

  // === cancel ===

  describe("cancel", () => {
    it("transitions from join to fill", () => {
      const next = transitionInteraction(joinState, { kind: "cancel" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("transitions from reattach to fill", () => {
      const next = transitionInteraction(reattachState, { kind: "cancel" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("rejects from fill mode (nothing to cancel)", () => {
      const next = transitionInteraction(fillState, { kind: "cancel" });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionInteraction(designState, { kind: "cancel" });
      expect(next).toBeNull();
    });
  });

  // === activeClueDeleted ===

  describe("activeClueDeleted", () => {
    it("transitions from reattach to fill (active clue was deleted)", () => {
      const next = transitionInteraction(reattachState, { kind: "activeClueDeleted" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("rejects from fill mode", () => {
      const next = transitionInteraction(fillState, { kind: "activeClueDeleted" });
      expect(next).toBeNull();
    });

    it("rejects from join mode", () => {
      const next = transitionInteraction(joinState, { kind: "activeClueDeleted" });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionInteraction(designState, { kind: "activeClueDeleted" });
      expect(next).toBeNull();
    });
  });

  // === clueIndexChanged ===

  describe("clueIndexChanged", () => {
    it("adjusts clueIndex in reattach mode", () => {
      const next = transitionInteraction(reattachState, {
        kind: "clueIndexChanged",
        newIndex: 1,
      });
      expect(next).toEqual({ kind: "reattach", clueIndex: 1 });
    });

    it("rejects from fill mode", () => {
      const next = transitionInteraction(fillState, {
        kind: "clueIndexChanged",
        newIndex: 1,
      });
      expect(next).toBeNull();
    });

    it("rejects from join mode", () => {
      const next = transitionInteraction(joinState, {
        kind: "clueIndexChanged",
        newIndex: 1,
      });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionInteraction(designState, {
        kind: "clueIndexChanged",
        newIndex: 1,
      });
      expect(next).toBeNull();
    });
  });

  // === Edge cases ===

  describe("edge cases", () => {
    it("startJoin preserves the sourceWordId", () => {
      const wordId = "3-5-across" as WordId;
      const next = transitionInteraction(fillState, {
        kind: "startJoin",
        sourceWordId: wordId,
      });
      expect(next).toEqual({ kind: "join", sourceWordId: "3-5-across" });
    });

    it("startReattach preserves the clueIndex", () => {
      const next = transitionInteraction(fillState, {
        kind: "startReattach",
        clueIndex: 7,
      });
      expect(next).toEqual({ kind: "reattach", clueIndex: 7 });
    });

    it("cancel works from any join state regardless of sourceWordId", () => {
      const joinWithDifferentSource: BuilderInteraction = {
        kind: "join",
        sourceWordId: "5-1-down" as WordId,
      };
      const next = transitionInteraction(joinWithDifferentSource, { kind: "cancel" });
      expect(next).toEqual({ kind: "fill" });
    });
  });
});