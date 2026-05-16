import type { RawWorktree } from "./types.ts";
import { run } from "./spawn.ts";

async function git(args: readonly string[], opts: { cwd?: string; allowFail?: boolean } = {}): Promise<string> {
  const { stdout } = await run(["git", ...args], opts);
  return stdout;
}

export async function fetchPrune(mainWt: string): Promise<void> {
  await git(["-C", mainWt, "fetch", "--prune", "origin"], { allowFail: true });
}

export async function getRemoteUrl(mainWt: string): Promise<string | null> {
  try {
    return await git(["-C", mainWt, "remote", "get-url", "origin"]);
  } catch {
    return null;
  }
}

export async function listWorktrees(mainWt: string): Promise<RawWorktree[]> {
  const out = await git(["-C", mainWt, "worktree", "list", "--porcelain"]);
  const blocks = out.split(/\n\n+/).filter((b) => b.trim());
  const wts: RawWorktree[] = [];
  for (const block of blocks) {
    let path = "";
    let sha = "";
    let branch: string | null = null;
    let detached = false;
    let locked = false;
    let prunable = false;
    for (const line of block.split("\n")) {
      if (line.startsWith("worktree ")) path = line.slice(9);
      else if (line.startsWith("HEAD ")) sha = line.slice(5);
      else if (line.startsWith("branch ")) {
        branch = line.slice(7).replace(/^refs\/heads\//, "");
      } else if (line === "detached") detached = true;
      else if (line.startsWith("locked")) locked = true;
      else if (line.startsWith("prunable")) prunable = true;
    }
    if (path) {
      wts.push({ path, sha, branch: detached ? null : branch, locked, prunable });
    }
  }
  return wts;
}

export async function getRemoteBranches(mainWt: string): Promise<Set<string>> {
  const out = await git([
    "-C",
    mainWt,
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/remotes/origin/",
  ]);
  const set = new Set<string>();
  for (const line of out.split("\n")) {
    const name = line.trim();
    if (!name || name === "origin/HEAD") continue;
    set.add(name.replace(/^origin\//, ""));
  }
  return set;
}

/** Read every `branch.<X>.remote` config entry in one shot (avoids one spawn per branch). */
export async function getAllUpstreams(mainWt: string): Promise<Map<string, string>> {
  const { stdout } = await run(
    ["git", "-C", mainWt, "config", "--get-regexp", "^branch\\..*\\.remote$"],
    { allowFail: true },
  );
  const m = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const match = line.match(/^branch\.(.+)\.remote (.+)$/);
    if (match) m.set(match[1]!, match[2]!);
  }
  return m;
}

export async function isDirty(wtPath: string): Promise<boolean> {
  try {
    const out = await git(["-C", wtPath, "status", "--porcelain"], { allowFail: true });
    return out.length > 0;
  } catch {
    return false;
  }
}
