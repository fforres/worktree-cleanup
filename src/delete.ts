import type { Worktree } from "./types.ts";
import { run } from "./spawn.ts";

export interface DeleteOutcome {
  worktree: Worktree;
  ok: boolean;
  message: string;
}

export async function performDeletes(
  selected: readonly Worktree[],
  opts: { dryRun?: boolean } = {},
): Promise<DeleteOutcome[]> {
  const out: DeleteOutcome[] = [];
  for (const wt of selected) {
    if (wt.dirty) {
      out.push({
        worktree: wt,
        ok: false,
        message: `SKIP ${wt.path} — uncommitted changes (refusing to pass --force)`,
      });
      continue;
    }
    if (opts.dryRun) {
      out.push({
        worktree: wt,
        ok: true,
        message: `[dry-run] WOULD run: git worktree remove ${wt.path}`,
      });
      continue;
    }
    const res = await run(["git", "worktree", "remove", wt.path], { allowFail: true });
    if (res.exit === 0) {
      out.push({ worktree: wt, ok: true, message: `removed ${wt.path}` });
    } else {
      out.push({
        worktree: wt,
        ok: false,
        message: `FAILED ${wt.path} (git exited ${res.exit})`,
      });
    }
  }
  return out;
}
