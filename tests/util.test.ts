import { describe, expect, it } from "vitest";
import { isRowLocked, needsForceConfirm, stateFlags, truncate } from "../src/ui/util.ts";

describe("stateFlags", () => {
  it("is empty when everything is clean", () => {
    expect(stateFlags({ dirty: false, ahead: 0, behind: 0 })).toBe("");
    expect(stateFlags({})).toBe("");
    expect(stateFlags({ ahead: null, behind: null })).toBe("");
  });
  it("emits * for dirty", () => {
    expect(stateFlags({ dirty: true })).toBe("*");
  });
  it("emits ↑N for ahead", () => {
    expect(stateFlags({ ahead: 3 })).toBe("↑3");
  });
  it("emits ↓N for behind", () => {
    expect(stateFlags({ behind: 2 })).toBe("↓2");
  });
  it("combines flags in order: dirty, ahead, behind", () => {
    expect(stateFlags({ dirty: true, ahead: 1, behind: 4 })).toBe("*↑1↓4");
  });
  it("ignores zero ahead/behind", () => {
    expect(stateFlags({ dirty: true, ahead: 0, behind: 0 })).toBe("*");
  });
});

describe("isRowLocked", () => {
  it("only MAIN_WORKTREE is locked — everything else is selectable", () => {
    expect(isRowLocked("MAIN_WORKTREE")).toBe(true);
    for (const s of ["PROTECTED", "REMOTE_DELETED", "REMOTE_EXISTS", "NEVER_PUSHED", "DETACHED"] as const) {
      expect(isRowLocked(s)).toBe(false);
    }
  });
});

describe("needsForceConfirm", () => {
  it("true for dirty rows", () => {
    expect(needsForceConfirm({ status: "REMOTE_DELETED", dirty: true })).toBe(true);
  });
  it("true for PROTECTED rows even when clean", () => {
    expect(needsForceConfirm({ status: "PROTECTED", dirty: false })).toBe(true);
  });
  it("false for clean non-PROTECTED rows", () => {
    for (const s of ["REMOTE_DELETED", "REMOTE_EXISTS", "NEVER_PUSHED", "DETACHED", "MAIN_WORKTREE"] as const) {
      expect(needsForceConfirm({ status: s, dirty: false })).toBe(false);
    }
  });
});

describe("truncate", () => {
  it("is identity when string fits", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("appends ellipsis when truncating", () => {
    expect(truncate("hello world", 5)).toBe("hell…");
  });
  it("handles edge widths", () => {
    expect(truncate("abc", 1)).toBe("a");
    expect(truncate("abc", 0)).toBe("");
  });
});
