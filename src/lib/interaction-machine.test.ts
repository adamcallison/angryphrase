import { describe, it, expect } from "vitest";
import { transitionBuilderInteraction } from "./interaction-machine";
import type { BuilderInteraction, WordId } from "./types";

describe("transitionInteraction", () => {
  const designState: BuilderInteraction = { kind: "design" };
  const fillState: BuilderInteraction = { kind: "fill" };
  const joinState: BuilderInteraction = { kind: "join", sourceWordId: "0-0-across" as WordId };
  const reattachState: BuilderInteraction = { kind: "reattach", clueIndex: 2 };

  // === switchMode ===

  describe("switchMode", () => {
    it("transitions from design to fill", () => {
      const next = transitionBuilderInteraction(designState, { kind: "switchMode", mode: "fill" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("transitions from fill to design", () => {
      const next = transitionBuilderInteraction(fillState, { kind: "switchMode", mode: "design" });
      expect(next).toEqual({ kind: "design" });
    });

    it("transitions from join to design (cancels join)", () => {
      const next = transitionBuilderInteraction(joinState, { kind: "switchMode", mode: "design" });
      expect(next).toEqual({ kind: "design" });
    });

    it("transitions from reattach to fill (cancels reattach)", () => {
      const next = transitionBuilderInteraction(reattachState, { kind: "switchMode", mode: "fill" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("can switch to the same mode (idempotent)", () => {
      const next = transitionBuilderInteraction(fillState, { kind: "switchMode", mode: "fill" });
      expect(next).toEqual({ kind: "fill" });
    });
  });

  // === startJoin ===

  describe("startJoin", () => {
    it("transitions from fill to join", () => {
      const next = transitionBuilderInteraction(fillState, {
        kind: "startJoin",
        sourceWordId: "0-3-down" as WordId,
      });
      expect(next).toEqual({ kind: "join", sourceWordId: "0-3-down" });
    });

    it("rejects from design mode", () => {
      const next = transitionBuilderInteraction(designState, {
        kind: "startJoin",
        sourceWordId: "0-3-down" as WordId,
      });
      expect(next).toBeNull();
    });

    it("rejects from join mode (already joining)", () => {
      const next = transitionBuilderInteraction(joinState, {
        kind: "startJoin",
        sourceWordId: "0-3-down" as WordId,
      });
      expect(next).toBeNull();
    });

    it("rejects from reattach mode", () => {
      const next = transitionBuilderInteraction(reattachState, {
        kind: "startJoin",
        sourceWordId: "0-3-down" as WordId,
      });
      expect(next).toBeNull();
    });
  });

  // === finishJoin ===

  describe("finishJoin", () => {
    it("transitions from join to fill", () => {
      const next = transitionBuilderInteraction(joinState, { kind: "finishJoin" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("rejects from fill mode (not joining)", () => {
      const next = transitionBuilderInteraction(fillState, { kind: "finishJoin" });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionBuilderInteraction(designState, { kind: "finishJoin" });
      expect(next).toBeNull();
    });

    it("rejects from reattach mode", () => {
      const next = transitionBuilderInteraction(reattachState, { kind: "finishJoin" });
      expect(next).toBeNull();
    });
  });

  // === startReattach ===

  describe("startReattach", () => {
    it("transitions from fill to reattach", () => {
      const next = transitionBuilderInteraction(fillState, {
        kind: "startReattach",
        clueIndex: 3,
      });
      expect(next).toEqual({ kind: "reattach", clueIndex: 3 });
    });

    it("rejects from design mode", () => {
      const next = transitionBuilderInteraction(designState, {
        kind: "startReattach",
        clueIndex: 3,
      });
      expect(next).toBeNull();
    });

    it("rejects from join mode", () => {
      const next = transitionBuilderInteraction(joinState, {
        kind: "startReattach",
        clueIndex: 3,
      });
      expect(next).toBeNull();
    });

    it("rejects from reattach mode (already reattaching)", () => {
      const next = transitionBuilderInteraction(reattachState, {
        kind: "startReattach",
        clueIndex: 3,
      });
      expect(next).toBeNull();
    });
  });

  // === finishReattach ===

  describe("finishReattach", () => {
    it("transitions from reattach to fill", () => {
      const next = transitionBuilderInteraction(reattachState, { kind: "finishReattach" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("rejects from fill mode (not reattaching)", () => {
      const next = transitionBuilderInteraction(fillState, { kind: "finishReattach" });
      expect(next).toBeNull();
    });

    it("rejects from join mode", () => {
      const next = transitionBuilderInteraction(joinState, { kind: "finishReattach" });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionBuilderInteraction(designState, { kind: "finishReattach" });
      expect(next).toBeNull();
    });
  });

  // === cancel ===

  describe("cancel", () => {
    it("transitions from join to fill", () => {
      const next = transitionBuilderInteraction(joinState, { kind: "cancel" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("transitions from reattach to fill", () => {
      const next = transitionBuilderInteraction(reattachState, { kind: "cancel" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("rejects from fill mode (nothing to cancel)", () => {
      const next = transitionBuilderInteraction(fillState, { kind: "cancel" });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionBuilderInteraction(designState, { kind: "cancel" });
      expect(next).toBeNull();
    });
  });

  // === activeClueDeleted ===

  describe("activeClueDeleted", () => {
    it("transitions from reattach to fill (active clue was deleted)", () => {
      const next = transitionBuilderInteraction(reattachState, { kind: "activeClueDeleted" });
      expect(next).toEqual({ kind: "fill" });
    });

    it("rejects from fill mode", () => {
      const next = transitionBuilderInteraction(fillState, { kind: "activeClueDeleted" });
      expect(next).toBeNull();
    });

    it("rejects from join mode", () => {
      const next = transitionBuilderInteraction(joinState, { kind: "activeClueDeleted" });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionBuilderInteraction(designState, { kind: "activeClueDeleted" });
      expect(next).toBeNull();
    });
  });

  // === clueIndexChanged ===

  describe("clueIndexChanged", () => {
    it("adjusts clueIndex in reattach mode", () => {
      const next = transitionBuilderInteraction(reattachState, {
        kind: "clueIndexChanged",
        newIndex: 1,
      });
      expect(next).toEqual({ kind: "reattach", clueIndex: 1 });
    });

    it("rejects from fill mode", () => {
      const next = transitionBuilderInteraction(fillState, {
        kind: "clueIndexChanged",
        newIndex: 1,
      });
      expect(next).toBeNull();
    });

    it("rejects from join mode", () => {
      const next = transitionBuilderInteraction(joinState, {
        kind: "clueIndexChanged",
        newIndex: 1,
      });
      expect(next).toBeNull();
    });

    it("rejects from design mode", () => {
      const next = transitionBuilderInteraction(designState, {
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
      const next = transitionBuilderInteraction(fillState, {
        kind: "startJoin",
        sourceWordId: wordId,
      });
      expect(next).toEqual({ kind: "join", sourceWordId: "3-5-across" });
    });

    it("startReattach preserves the clueIndex", () => {
      const next = transitionBuilderInteraction(fillState, {
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
      const next = transitionBuilderInteraction(joinWithDifferentSource, { kind: "cancel" });
      expect(next).toEqual({ kind: "fill" });
    });
  });
});