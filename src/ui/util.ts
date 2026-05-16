import type { Status } from "../types.ts";

export const COLORS = {
  cursorFg: "#000",
  cursorBg: "#ffd43b",
  disabledFg: "#666",
  detailMuted: "#aaa",
  detailFainter: "#666",
  headingFg: "#fff",
  hintFg: "#888",
  errorFg: "#ff6b6b",
  warningFg: "#ffd43b",
} as const;

export const STATUS_META: Record<Status, { color: string; immutable: boolean }> = {
  REMOTE_DELETED: { color: "#ff6b6b", immutable: false },
  REMOTE_EXISTS: { color: "#51cf66", immutable: false },
  NEVER_PUSHED: { color: "#ffd43b", immutable: false },
  DETACHED: { color: "#cc5de8", immutable: false },
  PROTECTED: { color: "#74c0fc", immutable: true },
  MAIN_WORKTREE: { color: "#74c0fc", immutable: true },
};

export function relPath(p: string, root: string): string {
  return p.startsWith(root + "/") ? p.slice(root.length + 1) : p;
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  if (n <= 1) return s.slice(0, n);
  return s.slice(0, n - 1) + "…";
}
