import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { memo, useMemo, useState } from "react";
import type { Worktree } from "../types.ts";
import { COLORS, STATUS_META, relPath, truncate } from "./util.ts";

interface Props {
  worktrees: readonly Worktree[];
  initialSelected: ReadonlySet<number>;
  onConfirm: (selectedIndices: ReadonlySet<number>) => void;
  onQuit: () => void;
  rootPath: string;
}

interface ColumnWidths {
  checkbox: number;
  status: number;
  location: number;
  path: number;
  branch: number;
}

function computeWidths(terminalWidth: number): ColumnWidths {
  const usable = Math.max(40, terminalWidth - 4);
  const checkbox = 3;
  const status = 15;
  const location = 12;
  const remaining = Math.max(20, usable - checkbox - status - location - 3);
  const path = Math.floor(remaining * 0.55);
  return { checkbox, status, location, path, branch: remaining - path };
}

export function Table({
  worktrees,
  initialSelected,
  onConfirm,
  onQuit,
  rootPath,
}: Props): React.ReactNode {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialSelected));
  const [cursor, setCursor] = useState(0);
  const { width } = useTerminalDimensions();
  const widths = useMemo(() => computeWidths(width), [width]);

  const total = worktrees.length;

  const toggle = (i: number) => {
    if (STATUS_META[worktrees[i]!.status].immutable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") return onQuit();
    switch (key.name) {
      case "up":
      case "k":
        return setCursor((c) => Math.max(0, c - 1));
        break;
      case "down":
      case "j":
        return setCursor((c) => Math.min(total - 1, c + 1));
      case "pageup":
        return setCursor((c) => Math.max(0, c - 10));
      case "pagedown":
        return setCursor((c) => Math.min(total - 1, c + 10));
      case "home":
        return setCursor(0);
      case "end":
        return setCursor(total - 1);
      case "g":
        return setCursor(key.shift ? total - 1 : 0);
      case "space":
        return toggle(cursor);
      case "a":
        return setSelected((prev) => {
          const allOn = worktrees.every(
            (w, i) => STATUS_META[w.status].immutable || prev.has(i),
          );
          if (allOn) return new Set();
          const next = new Set<number>();
          worktrees.forEach((w, i) => {
            if (!STATUS_META[w.status].immutable) next.add(i);
          });
          return next;
        });
      case "d":
        return setSelected(new Set(initialSelected));
      case "return":
        return onConfirm(selected);
      case "q":
      case "escape":
        return onQuit();
    }
  });

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <Header total={total} selectedCount={selected.size} />
      <box
        style={{
          flexDirection: "row",
          paddingTop: 1,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text fg={COLORS.hintFg}>{columnHeaders(widths)}</text>
      </box>
      <scrollbox
        style={{
          flexGrow: 1,
          borderStyle: "single",
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        {worktrees.map((wt, i) => (
          <Row
            key={wt.path}
            wt={wt}
            onCursor={i === cursor}
            selected={selected.has(i)}
            rootPath={rootPath}
            widths={widths}
          />
        ))}
      </scrollbox>
      <Detail wt={worktrees[cursor]} rootPath={rootPath} />
      <Footer />
    </box>
  );
}

function columnHeaders(w: ColumnWidths): string {
  return (
    "".padEnd(w.checkbox) +
    "STATUS".padEnd(w.status) +
    "LOC".padEnd(w.location) +
    "PATH".padEnd(w.path) +
    "BRANCH"
  );
}

function Header({ total, selectedCount }: { total: number; selectedCount: number }): React.ReactNode {
  return (
    <box
      style={{
        flexDirection: "row",
        borderStyle: "single",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={COLORS.headingFg} attributes={1}>
        worktree-cleanup
      </text>
      <text fg={COLORS.hintFg}>
        {"  "}({selectedCount}/{total} selected)
      </text>
    </box>
  );
}

function Footer(): React.ReactNode {
  return (
    <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1, paddingTop: 1 }}>
      <text fg={COLORS.hintFg}>
        ↑/↓ move · space toggle · a all · d reset defaults · enter confirm · q quit
      </text>
    </box>
  );
}

const Row = memo(function Row({
  wt,
  onCursor,
  selected,
  rootPath,
  widths,
}: {
  wt: Worktree;
  onCursor: boolean;
  selected: boolean;
  rootPath: string;
  widths: ColumnWidths;
}): React.ReactNode {
  const meta = STATUS_META[wt.status];
  const checkbox = meta.immutable ? "▪" : selected ? "■" : "□";
  const path = relPath(wt.path, rootPath);
  const branch = (wt.branch ?? "(detached)") + (wt.dirty ? " *" : "");
  const line =
    checkbox.padEnd(widths.checkbox) +
    truncate(wt.status, widths.status - 1).padEnd(widths.status) +
    truncate(wt.location, widths.location - 1).padEnd(widths.location) +
    truncate(path, widths.path - 1).padEnd(widths.path) +
    truncate(branch, widths.branch);
  const fg = onCursor
    ? COLORS.cursorFg
    : meta.immutable
      ? COLORS.disabledFg
      : meta.color;
  return (
    <text fg={fg} bg={onCursor ? COLORS.cursorBg : "transparent"}>
      {line}
    </text>
  );
});

function Detail({ wt, rootPath }: { wt: Worktree | undefined; rootPath: string }): React.ReactNode {
  if (!wt) return null;
  return (
    <box
      style={{
        flexDirection: "column",
        borderStyle: "single",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={COLORS.headingFg} attributes={1}>
        {relPath(wt.path, rootPath)}
      </text>
      <text fg={COLORS.detailMuted}>reason: {wt.reason}</text>
      <text fg={COLORS.detailMuted}>local:  {wt.path}</text>
      <text fg={wt.remoteUrl ? COLORS.detailMuted : COLORS.detailFainter}>
        remote: {wt.remoteUrl ?? "(not on origin)"}
      </text>
      {wt.pr ? (
        <text fg={COLORS.detailMuted}>
          PR #{wt.pr.number} {wt.pr.state} — {wt.pr.title}
        </text>
      ) : null}
      {wt.dirty ? (
        <text fg={COLORS.errorFg}>uncommitted changes in this worktree (*)</text>
      ) : null}
    </box>
  );
}
