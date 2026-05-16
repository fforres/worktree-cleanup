import { join } from "node:path";
import { buildWorktree, compareWorktrees } from "./classify.ts";
import {
  fetchPrune,
  getAllUpstreams,
  getLocalState,
  getRemoteBranches,
  getRemoteUrl,
  listWorktrees,
} from "./git.ts";
import { branchUrl, fetchPrInfo, ghAvailable } from "./github.ts";
import { pMap } from "./parallel.ts";
import type { AppOptions, Worktree } from "./types.ts";

export interface DiscoverResult {
  root: string;
  mainWt: string;
  worktrees: Worktree[];
  remoteUrl: string | null;
  ghAvailable: boolean;
}

export async function discover(
  opts: AppOptions,
  onProgress?: (msg: string) => void,
): Promise<DiscoverResult> {
  const mainWt = join(opts.root, "main");

  onProgress?.("listing worktrees");
  const raw = await listWorktrees(mainWt);

  if (opts.fetch) {
    onProgress?.("git fetch --prune origin");
    await fetchPrune(mainWt);
  }

  onProgress?.("reading remote refs");
  const [remoteBranches, remoteUrl, ghOk, upstreams] = await Promise.all([
    getRemoteBranches(mainWt),
    getRemoteUrl(mainWt),
    ghAvailable(),
    getAllUpstreams(mainWt),
  ]);

  onProgress?.(`analyzing ${raw.length} worktrees (concurrency=${opts.concurrency})`);

  const worktrees = await pMap(raw, opts.concurrency, async (r) => {
    const local = await getLocalState(r.path);
    const upstream = r.branch ? (upstreams.get(r.branch) ?? null) : null;
    let pr: Worktree["pr"] = null;
    if (opts.withPrs && ghOk && r.branch && (remoteBranches.has(r.branch) || upstream)) {
      pr = await fetchPrInfo(r.branch, mainWt);
    }
    const remoteBranchUrl =
      r.branch && remoteUrl && remoteBranches.has(r.branch)
        ? (branchUrl(remoteUrl, r.branch) ?? undefined)
        : undefined;
    return buildWorktree({
      raw: r,
      mainWt,
      root: opts.root,
      remoteBranches,
      upstream,
      protectedPatterns: opts.extraProtected,
      pr,
      remoteUrl: remoteBranchUrl,
      dirty: local.dirty,
      ahead: local.ahead,
      behind: local.behind,
    });
  });

  worktrees.sort(compareWorktrees);
  return { root: opts.root, mainWt, worktrees, remoteUrl, ghAvailable: ghOk };
}
