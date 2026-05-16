import type { Worktree } from "./types.ts";

export interface DeleteOutcome {
  worktree: Worktree;
  ok: boolean;
  message: string;
}

export async function performDeletes(
  selected: readonly Worktree[],
): Promise<DeleteOutcome[]> {
  return selected.map((wt) => ({
    worktree: wt,
    ok: true,
    message: wt.dirty
      ? `[noop] WOULD refuse to remove ${wt.path} — uncommitted changes`
      : `[noop] WOULD run: git worktree remove ${wt.path}`,
  }));
}
