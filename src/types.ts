export type Status =
  | "REMOTE_DELETED"
  | "REMOTE_EXISTS"
  | "NEVER_PUSHED"
  | "DETACHED"
  | "PROTECTED"
  | "MAIN_WORKTREE";

export type Location = "FIRST_LAYER" | "NESTED" | "OUTSIDE" | "MAIN";

export interface RawWorktree {
  path: string;
  sha: string;
  branch: string | null;
  locked: boolean;
  prunable: boolean;
}

export interface PrInfo {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  title: string;
  url: string;
}

export interface Worktree extends RawWorktree {
  status: Status;
  location: Location;
  reason: string;
  defaultSelected: boolean;
  upstream?: string;
  pr?: PrInfo | null;
  remoteUrl?: string;
  dirty?: boolean;
  ahead?: number | null;
  behind?: number | null;
}

export interface AppOptions {
  root: string;
  fetch: boolean;
  withPrs: boolean;
  concurrency: number;
  extraProtected: string[];
  dryRun: boolean;
}
