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

describe("performDeletes (no-op)", () => {
  it("returns one outcome per input, always ok=true, never touches disk", async () => {
    const items = [wt({ path: "/a" }), wt({ path: "/b", dirty: true })];
    const out = await performDeletes(items);
    expect(out).toHaveLength(2);
    expect(out.every((o) => o.ok)).toBe(true);
  });

  it("flags dirty worktrees in the message", async () => {
    const out = await performDeletes([wt({ path: "/dirty", dirty: true })]);
    expect(out[0]!.message).toContain("uncommitted");
    expect(out[0]!.message).toContain("noop");
  });

  it("uses the git worktree remove form for clean trees", async () => {
    const out = await performDeletes([wt({ path: "/clean" })]);
    expect(out[0]!.message).toContain("git worktree remove /clean");
    expect(out[0]!.message).toContain("noop");
  });
});
