import { describe, expect, it } from "vitest";
import { stateFlags, truncate } from "../src/ui/util.ts";

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
