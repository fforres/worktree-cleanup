import { useKeyboard } from "@opentui/react";
import type { Worktree } from "../types.ts";
import { COLORS, relPath } from "./util.ts";

interface Props {
  forceRequired: readonly Worktree[];
  safeCount: number;
  rootPath: string;
  onConfirmAll: () => void;
  onSafeOnly: () => void;
  onCancel: () => void;
}

/**
 * Second-stage confirmation, shown only when the user's selection contains
 * rows that need an extra "are you sure?" gate: dirty worktrees (uncommitted
 * work will be destroyed) and PROTECTED worktrees (the user-configured safety
 * net). The user has three exits:
 *
 *   y   — go through with all of it; --force is passed to git
 *   n   — skip just the force-required rows, delete the safe subset
 *   esc — bail out entirely, delete nothing
 */
export function ConfirmForce({
  forceRequired,
  safeCount,
  rootPath,
  onConfirmAll,
  onSafeOnly,
  onCancel,
}: Props): React.ReactNode {
  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") return onCancel();
    if (key.name === "y") return onConfirmAll();
    if (key.name === "n") return onSafeOnly();
    if (key.name === "escape" || key.name === "q") return onCancel();
  });

  const dirtyCount = forceRequired.filter((w) => w.dirty).length;
  const protectedCount = forceRequired.filter((w) => w.status === "PROTECTED").length;

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ borderStyle: "single", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.errorFg} attributes={1}>
          ⚠ {forceRequired.length} worktree{forceRequired.length === 1 ? "" : "s"} need extra confirmation
        </text>
      </box>
      <box style={{ paddingLeft: 1, paddingRight: 1, paddingTop: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.detailMuted}>
          The rows below are not safe to delete without an explicit yes. Saying
          yes is equivalent to running `git worktree remove --force` — any
          uncommitted work will be irreversibly destroyed.
        </text>
      </box>
      <scrollbox style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1, paddingTop: 1 }}>
        {forceRequired.map((wt) => (
          <text style={{ flexShrink: 0 }} key={wt.path} fg={COLORS.errorFg}>
            ⚠ {relPath(wt.path, rootPath)}  ({wt.branch ?? "detached"}) — {reasonFor(wt)}
          </text>
        ))}
      </scrollbox>
      <box style={{ paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.detailMuted}>
          Summary: {dirtyCount} with uncommitted changes · {protectedCount} protected branches · {safeCount} other rows are safe to delete either way.
        </text>
      </box>
      <box style={{ borderStyle: "single", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>
          [y] yes, force-delete all {forceRequired.length + safeCount}   ·   [n] no, only delete the {safeCount} safe ones   ·   [esc] cancel
        </text>
      </box>
    </box>
  );
}

function reasonFor(wt: Worktree): string {
  if (wt.dirty && wt.status === "PROTECTED") return "uncommitted changes + protected branch";
  if (wt.dirty) return "uncommitted changes";
  if (wt.status === "PROTECTED") return "protected branch";
  return "force-required";
}
