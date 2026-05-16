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
  checkboxSelected: "#22c55e",
  checkboxUnselected: "#555",
  checkboxLocked: "#5588aa",
} as const;

// NB: keep these three values the same visual width — both string .length and
// terminal column width — so the row grid stays aligned without per-glyph
// padding logic. " 🔒 " is a surrogate-pair (length 4) AND 4 columns wide, which
// happens to match 1"[✓]" / "[ ]" at length 3 / 3 cols when padded to 4.
export const CHECKBOX = {
  selected: "[✓]",
  unselected: "[ ]",
  locked: " 🔒 ",
} as const;

export const STATUS_META: Record<Status, { color: string; immutable: boolean }> = {
  REMOTE_DELETED: { color: "#ff6b6b", immutable: false },
  REMOTE_EXISTS: { color: "#51cf66", immutable: false },
  NEVER_PUSHED: { color: "#ffd43b", immutable: false },
  DETACHED: { color: "#cc5de8", immutable: false },
  PROTECTED: { color: "#74c0fc", immutable: false },
  MAIN_WORKTREE: { color: "#74c0fc", immutable: true },
};

/**
 * Only the primary worktree is truly un-deletable — removing it leaves git in a
 * corrupt state. PROTECTED and dirty rows are *selectable*; the confirm flow
 * gates them with an extra "are you sure?" step (see App.tsx forceConfirming).
 */
export function isRowLocked(status: Status): boolean {
  return status === "MAIN_WORKTREE";
}

/** True if removing this worktree requires an extra confirmation. */
export function needsForceConfirm(args: {
  status: Status;
  dirty?: boolean;
}): boolean {
  return Boolean(args.dirty) || args.status === "PROTECTED";
}

export function relPath(p: string, root: string): string {
  return p.startsWith(root + "/") ? p.slice(root.length + 1) : p;
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  if (n <= 1) return s.slice(0, n);
  return s.slice(0, n - 1) + "…";
}

/**
 * Compact flag string for the STATE column. Empty when everything's clean.
 *   '*'   uncommitted changes
 *   '↑N'  N commits in HEAD not in upstream
 *   '↓N'  N commits in upstream not in HEAD
 */
export function stateFlags(args: {
  dirty?: boolean;
  ahead?: number | null;
  behind?: number | null;
}): string {
  const parts: string[] = [];
  if (args.dirty) parts.push("*");
  if (args.ahead && args.ahead > 0) parts.push(`↑${args.ahead}`);
  if (args.behind && args.behind > 0) parts.push(`↓${args.behind}`);
  return parts.join("");
}
