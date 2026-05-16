import { describe, expect, it } from "vitest";
import { performDeletes } from "../src/delete.ts";
import type { Worktree } from "../src/types.ts";

function wt(partial: Partial<Worktree>): Worktree {
  return {
    path: partial.path ?? "/tmp/wt",
    sha: "abc",
    branch: partial.branch ?? "feat",
    locked: false,
    prunable: false,
    status: partial.status ?? "REMOTE_DELETED",
    location: partial.location ?? "FIRST_LAYER",
    reason: "test",
    defaultSelected: true,
    dirty: partial.dirty,
  };
}

describe("performDeletes — dry-run mode", () => {
  it("returns one outcome per input, never touches disk", async () => {
    const items = [wt({ path: "/a" }), wt({ path: "/b", dirty: true })];
    const out = await performDeletes(items, { dryRun: true });
    expect(out).toHaveLength(2);
  });

  it("flags dirty worktrees and skips them even in dry-run", async () => {
    const out = await performDeletes([wt({ path: "/dirty", dirty: true })], {
      dryRun: true,
    });
    expect(out[0]!.ok).toBe(false);
    expect(out[0]!.message).toContain("uncommitted");
  });

  it("uses the git worktree remove form for clean trees in dry-run", async () => {
    const out = await performDeletes([wt({ path: "/clean" })], { dryRun: true });
    expect(out[0]!.ok).toBe(true);
    expect(out[0]!.message).toContain("dry-run");
    expect(out[0]!.message).toContain("git worktree remove /clean");
  });
});

describe("performDeletes — real mode", () => {
  it("refuses dirty worktrees without spawning git", async () => {
    const out = await performDeletes([wt({ path: "/dirty", dirty: true })]);
    expect(out[0]!.ok).toBe(false);
    expect(out[0]!.message).toContain("uncommitted");
    expect(out[0]!.message).not.toContain("dry-run");
  });

  it("reports FAILED when git exits non-zero for a bogus path", async () => {
    // Use a clearly invalid path so git exits non-zero without touching anything real.
    const out = await performDeletes([wt({ path: "/this/path/does/not/exist/42" })]);
    expect(out[0]!.ok).toBe(false);
    expect(out[0]!.message).toContain("FAILED");
  });
});
