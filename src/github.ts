import type { PrInfo } from "./types.ts";
import { run } from "./spawn.ts";

export async function ghAvailable(): Promise<boolean> {
  const { exit } = await run(["gh", "--version"], { allowFail: true });
  return exit === 0;
}

export async function fetchPrInfo(branch: string, mainWt: string): Promise<PrInfo | null> {
  const { stdout, exit } = await run(
    [
      "gh", "pr", "list",
      "--state", "all",
      "--head", branch,
      "--limit", "1",
      "--json", "number,state,title,url",
    ],
    { cwd: mainWt, allowFail: true },
  );
  if (exit !== 0 || !stdout) return null;
  try {
    return (JSON.parse(stdout) as PrInfo[])[0] ?? null;
  } catch {
    return null;
  }
}

const GITHUB_REMOTE_RE =
  /^(?:git@github\.com:|https?:\/\/github\.com\/)([^/]+)\/(.+?)(?:\.git)?$/;

export function branchUrl(remoteUrl: string, branch: string): string | null {
  const m = remoteUrl.match(GITHUB_REMOTE_RE);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}/tree/${encodeURIComponent(branch)}`;
}
