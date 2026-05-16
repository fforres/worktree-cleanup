import { useKeyboard } from "@opentui/react";
import type { Worktree } from "../types.ts";
import { COLORS, relPath } from "./util.ts";

interface Props {
  selected: readonly Worktree[];
  onConfirm: () => void;
  onCancel: () => void;
  rootPath: string;
}

export function Confirm({ selected, onConfirm, onCancel, rootPath }: Props): React.ReactNode {
  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") return onCancel();
    if (key.name === "y") return onConfirm();
    if (key.name === "n" || key.name === "escape" || key.name === "q") return onCancel();
  });

  const dirty = selected.filter((s) => s.dirty);

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ borderStyle: "single", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.headingFg} attributes={1}>
          Confirm removal ({selected.length} worktree{selected.length === 1 ? "" : "s"})
        </text>
      </box>
      <scrollbox style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1, paddingTop: 1 }}>
        {selected.map((wt) => (
          <text style={{ flexShrink: 0 }} key={wt.path} fg={wt.dirty ? COLORS.errorFg : "#ddd"}>
            {wt.dirty ? "⚠ " : "  "}
            {relPath(wt.path, rootPath)}  ({wt.branch ?? "detached"})
          </text>
        ))}
      </scrollbox>
      {dirty.length > 0 ? (
        <box style={{ paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
          <text style={{ flexShrink: 0 }} fg={COLORS.errorFg}>
            {dirty.length} of these have uncommitted changes — they will be SKIPPED.
          </text>
        </box>
      ) : null}
      <box style={{ borderStyle: "single", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>
          Proceed? [y]es / [n]o / [esc] cancel
        </text>
      </box>
    </box>
  );
}
