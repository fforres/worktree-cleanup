import type { Worktree } from "./types.ts";
import { run } from "./spawn.ts";

export interface DeleteOutcome {
  worktree: Worktree;
  ok: boolean;
  message: string;
}

export type DeleteEvent =
  | { kind: "start"; index: number; worktree: Worktree }
  | { kind: "finish"; index: number; worktree: Worktree; outcome: DeleteOutcome };

export interface DeleteOptions {
  dryRun?: boolean;
  force?: boolean;
  /**
   * Working directory for the `git worktree remove` subprocess. Must be a path
   * inside a git repo (typically the main worktree). Required for real runs
   * because `git` resolves the repo from CWD; invoking it from a non-repo
   * parent dir (e.g. `~/GITHUB/skyward`) makes every removal fail with
   * "fatal: not a git repository". Dry-run paths don't need it.
   */
  cwd?: string;
  /**
   * Fires synchronously around every item so the UI can render a live
   * "deleting X…" spinner. `start` fires before spawning git; `finish` fires
   * after the outcome is known. Items always run serially — git worktree
   * operations can contend on the parent repo's index.
   */
  onEvent?: (event: DeleteEvent) => void;
}

export async function performDeletes(
  selected: readonly Worktree[],
  opts: DeleteOptions = {},
): Promise<DeleteOutcome[]> {
  const out: DeleteOutcome[] = [];
  for (let i = 0; i < selected.length; i++) {
    const wt = selected[i]!;
    opts.onEvent?.({ kind: "start", index: i, worktree: wt });
    const outcome = await deleteOne(wt, opts);
    out.push(outcome);
    opts.onEvent?.({ kind: "finish", index: i, worktree: wt, outcome });
  }
  return out;
}

async function deleteOne(
  wt: Worktree,
  opts: DeleteOptions,
): Promise<DeleteOutcome> {
  if (wt.status === "MAIN_WORKTREE") {
    return {
      worktree: wt,
      ok: false,
      message: `SKIP ${wt.path} — primary worktree (cannot be removed)`,
    };
  }
  if (wt.dirty && !opts.force) {
    return {
      worktree: wt,
      ok: false,
      message: `SKIP ${wt.path} — uncommitted changes (re-run with --force to override)`,
    };
  }
  const args = ["git", "worktree", "remove"];
  if (opts.force) args.push("--force");
  args.push(wt.path);
  if (opts.dryRun) {
    return {
      worktree: wt,
      ok: true,
      message: `[dry-run] WOULD run: ${args.join(" ")}`,
    };
  }
  const res = await run(args, { allowFail: true, cwd: opts.cwd });
  if (res.exit === 0) {
    return { worktree: wt, ok: true, message: `removed ${wt.path}` };
  }
  const detail = res.stderr || res.stdout || "(no output from git)";
  return {
    worktree: wt,
    ok: false,
    message: `FAILED ${wt.path} (git exited ${res.exit}): ${detail}`,
  };
}
