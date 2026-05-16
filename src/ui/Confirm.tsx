import { useKeyboard } from "@opentui/react";
import type { Worktree } from "../types.ts";
import { COLORS, needsForceConfirm, relPath } from "./util.ts";

interface Props {
  selected: readonly Worktree[];
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
  rootPath: string;
}

export function Confirm({
  selected,
  onConfirm,
  onBack,
  onCancel,
  rootPath,
}: Props): React.ReactNode {
  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") return onCancel();
    if (key.name === "y") return onConfirm();
    if (key.name === "n") return onBack();
    if (key.name === "escape" || key.name === "q") return onCancel();
  });

  const forceCount = selected.filter((s) => needsForceConfirm(s)).length;

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ borderStyle: "single", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.headingFg} attributes={1}>
          Confirm removal ({selected.length} worktree{selected.length === 1 ? "" : "s"})
        </text>
      </box>
      <scrollbox style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1, paddingTop: 1 }}>
        {selected.map((wt) => (
          <text style={{ flexShrink: 0 }} key={wt.path} fg={needsForceConfirm(wt) ? COLORS.errorFg : "#ddd"}>
            {needsForceConfirm(wt) ? "⚠ " : "  "}
            {relPath(wt.path, rootPath)}  ({wt.branch ?? "detached"})
          </text>
        ))}
      </scrollbox>
      {forceCount > 0 ? (
        <box style={{ paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
          <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>
            {forceCount} row{forceCount === 1 ? "" : "s"} need extra confirmation — you'll get one more prompt before anything is deleted.
          </text>
        </box>
      ) : null}
      <box style={{ borderStyle: "single", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>
          [y] delete   ·   [n] back to selection   ·   [esc] cancel
        </text>
      </box>
    </box>
  );
}
