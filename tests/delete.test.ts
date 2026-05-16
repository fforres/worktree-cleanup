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
    expect(out[0]!.message).toContain("--force");
    expect(out[0]!.message).not.toContain("dry-run");
  });

  it("reports FAILED and includes git's stderr for a bogus path", async () => {
    // Use a clearly invalid path so git exits non-zero without touching anything real.
    const out = await performDeletes([wt({ path: "/this/path/does/not/exist/42" })]);
    expect(out[0]!.ok).toBe(false);
    expect(out[0]!.message).toContain("FAILED");
    // git always writes *something* to stderr on failure (or we fall back to a
    // synthetic placeholder). Either way the message must not end at the exit code.
    expect(out[0]!.message).toMatch(/:\s+.+/);
  });
});

describe("performDeletes — onEvent callback", () => {
  it("fires start + finish per item in order, with matching indexes", async () => {
    const items = [
      wt({ path: "/a" }),
      wt({ path: "/b" }),
      wt({ path: "/c" }),
    ];
    const events: Array<{ kind: "start" | "finish"; index: number; path: string }> = [];
    await performDeletes(items, {
      dryRun: true,
      onEvent: (e) => events.push({ kind: e.kind, index: e.index, path: e.worktree.path }),
    });
    expect(events).toEqual([
      { kind: "start", index: 0, path: "/a" },
      { kind: "finish", index: 0, path: "/a" },
      { kind: "start", index: 1, path: "/b" },
      { kind: "finish", index: 1, path: "/b" },
      { kind: "start", index: 2, path: "/c" },
      { kind: "finish", index: 2, path: "/c" },
    ]);
  });
});

describe("performDeletes — --force", () => {
  it("dry-run with --force includes --force in the printed command", async () => {
    const out = await performDeletes([wt({ path: "/clean" })], {
      dryRun: true,
      force: true,
    });
    expect(out[0]!.ok).toBe(true);
    expect(out[0]!.message).toContain("git worktree remove --force /clean");
  });

  it("dry-run with --force does NOT skip dirty worktrees", async () => {
    const out = await performDeletes([wt({ path: "/dirty", dirty: true })], {
      dryRun: true,
      force: true,
    });
    expect(out[0]!.ok).toBe(true);
    expect(out[0]!.message).toContain("--force");
    expect(out[0]!.message).not.toContain("uncommitted");
  });

  it("MAIN_WORKTREE is refused even with --force (defense in depth)", async () => {
    const out = await performDeletes(
      [wt({ path: "/main", status: "MAIN_WORKTREE" })],
      { force: true, dryRun: true },
    );
    expect(out[0]!.ok).toBe(false);
    expect(out[0]!.message).toContain("primary worktree");
  });
});
