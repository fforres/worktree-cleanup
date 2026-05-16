import { describe, expect, it } from "vitest";
import { classify, isImmutable, locationOf } from "../src/classify.ts";
import { DEFAULT_PROTECTED } from "../src/protected.ts";
import type { RawWorktree } from "../src/types.ts";

const ROOT = "/repos/worktrees";
const MAIN = `${ROOT}/main`;

function rw(path: string, branch: string | null): RawWorktree {
  return { path, sha: "abc", branch, locked: false, prunable: false };
}

describe("locationOf", () => {
  it("identifies the main worktree", () => {
    expect(locationOf(MAIN, ROOT, MAIN)).toBe("MAIN");
  });
  it("identifies first-layer dirs under the root", () => {
    expect(locationOf(`${ROOT}/feature_a`, ROOT, MAIN)).toBe("FIRST_LAYER");
  });
  it("identifies nested dirs", () => {
    expect(locationOf(`${ROOT}/team/feature_a`, ROOT, MAIN)).toBe("NESTED");
  });
  it("identifies paths outside the root", () => {
    expect(locationOf("/elsewhere/other_repo_branch", ROOT, MAIN)).toBe("OUTSIDE");
  });
});

describe("isImmutable", () => {
  it("is true for PROTECTED and MAIN_WORKTREE", () => {
    expect(isImmutable("PROTECTED")).toBe(true);
    expect(isImmutable("MAIN_WORKTREE")).toBe(true);
  });
  it("is false for every other status", () => {
    for (const s of ["REMOTE_DELETED", "REMOTE_EXISTS", "NEVER_PUSHED", "DETACHED"] as const) {
      expect(isImmutable(s)).toBe(false);
    }
  });
});

describe("classify", () => {
  const base = {
    mainWt: MAIN,
    root: ROOT,
    protectedPatterns: DEFAULT_PROTECTED,
  };

  it("MAIN_WORKTREE for the primary worktree", () => {
    const c = classify({
      ...base,
      raw: rw(MAIN, "main"),
      remoteBranches: new Set(["main"]),
      upstream: "origin",
    });
    expect(c.status).toBe("MAIN_WORKTREE");
    expect(c.defaultSelected).toBe(false);
  });

  it("DETACHED when branch is null", () => {
    const c = classify({
      ...base,
      raw: rw(`${ROOT}/legacy`, null),
      remoteBranches: new Set(),
      upstream: null,
    });
    expect(c.status).toBe("DETACHED");
    expect(c.defaultSelected).toBe(false);
  });

  it("PROTECTED when branch matches a protected pattern", () => {
    const c = classify({
      ...base,
      raw: rw(`${ROOT}/release_wt`, "release/2026-04"),
      remoteBranches: new Set(),
      upstream: null,
    });
    expect(c.status).toBe("PROTECTED");
    expect(c.defaultSelected).toBe(false);
  });

  it("REMOTE_EXISTS when origin still has the branch", () => {
    const c = classify({
      ...base,
      raw: rw(`${ROOT}/active`, "feat/active"),
      remoteBranches: new Set(["feat/active"]),
      upstream: "origin",
    });
    expect(c.status).toBe("REMOTE_EXISTS");
    expect(c.defaultSelected).toBe(false);
  });

  it("REMOTE_DELETED when upstream existed but remote ref is gone", () => {
    const c = classify({
      ...base,
      raw: rw(`${ROOT}/old_feature`, "old_feature"),
      remoteBranches: new Set(),
      upstream: "origin",
    });
    expect(c.status).toBe("REMOTE_DELETED");
    expect(c.defaultSelected).toBe(true);
  });

  it("NEVER_PUSHED when no upstream and no remote ref", () => {
    const c = classify({
      ...base,
      raw: rw(`${ROOT}/wip`, "wip"),
      remoteBranches: new Set(),
      upstream: null,
    });
    expect(c.status).toBe("NEVER_PUSHED");
    expect(c.defaultSelected).toBe(false);
  });

  it("NESTED REMOTE_DELETED is preselected", () => {
    const c = classify({
      ...base,
      raw: rw(`${ROOT}/team/sub`, "sub"),
      remoteBranches: new Set(),
      upstream: "origin",
    });
    expect(c.status).toBe("REMOTE_DELETED");
    expect(c.defaultSelected).toBe(true);
  });

  it("OUTSIDE REMOTE_DELETED is preselected", () => {
    const c = classify({
      ...base,
      raw: rw("/elsewhere/orphan", "orphan"),
      remoteBranches: new Set(),
      upstream: "origin",
    });
    expect(c.status).toBe("REMOTE_DELETED");
    expect(c.defaultSelected).toBe(true);
  });
});
