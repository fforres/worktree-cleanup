import { relative } from "node:path";
import type { Location, RawWorktree, Status, Worktree } from "./types.ts";
import { isProtected } from "./protected.ts";

export function locationOf(wtPath: string, root: string, mainWt: string): Location {
  if (wtPath === mainWt) return "MAIN";
  if (!wtPath.startsWith(root + "/") && wtPath !== root) return "OUTSIDE";
  return relative(root, wtPath).includes("/") ? "NESTED" : "FIRST_LAYER";
}

export function isImmutable(status: Status): boolean {
  return status === "PROTECTED" || status === "MAIN_WORKTREE";
}

export interface ClassifyInput {
  raw: RawWorktree;
  mainWt: string;
  root: string;
  remoteBranches: ReadonlySet<string>;
  upstream: string | null;
  protectedPatterns: readonly string[];
}

export interface Classification {
  status: Status;
  reason: string;
  defaultSelected: boolean;
}

export function classify(input: ClassifyInput): Classification {
  const { raw, mainWt, root, remoteBranches, upstream, protectedPatterns } = input;
  const location = locationOf(raw.path, root, mainWt);

  if (raw.path === mainWt) {
    return { status: "MAIN_WORKTREE", reason: "primary worktree of the repo", defaultSelected: false };
  }
  if (!raw.branch) {
    return { status: "DETACHED", reason: "detached HEAD (no branch)", defaultSelected: false };
  }
  if (isProtected(raw.branch, protectedPatterns)) {
    return {
      status: "PROTECTED",
      reason: `protected by pattern (branch: ${raw.branch})`,
      defaultSelected: false,
    };
  }
  if (remoteBranches.has(raw.branch)) {
    return {
      status: "REMOTE_EXISTS",
      reason: `origin/${raw.branch} still exists on GitHub`,
      defaultSelected: false,
    };
  }
  if (upstream) {
    return {
      status: "REMOTE_DELETED",
      reason: `origin/${raw.branch} was tracked but is now deleted`,
      defaultSelected: location !== "MAIN",
    };
  }
  return {
    status: "NEVER_PUSHED",
    reason: "no upstream config — branch was never pushed",
    defaultSelected: false,
  };
}

export function buildWorktree(
  input: ClassifyInput & { pr?: Worktree["pr"]; remoteUrl?: string; dirty?: boolean },
): Worktree {
  const cls = classify(input);
  return {
    ...input.raw,
    status: cls.status,
    location: locationOf(input.raw.path, input.root, input.mainWt),
    reason: cls.reason,
    defaultSelected: cls.defaultSelected,
    upstream: input.upstream ?? undefined,
    pr: input.pr ?? null,
    remoteUrl: input.remoteUrl,
    dirty: input.dirty,
  };
}
