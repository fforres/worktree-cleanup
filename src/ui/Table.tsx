import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { platform } from "node:os";
import type { Worktree } from "../types.ts";
import { run } from "../spawn.ts";
import {
  CHECKBOX,
  COLORS,
  STATUS_META,
  isRowLocked,
  needsForceConfirm,
  relPath,
  stateFlags,
  truncate,
} from "./util.ts";

/** Spawn the platform-native URL opener. macOS `open`, Linux `xdg-open`, Windows `start`. */
function openExternal(url: string): void {
  const cmd =
    platform() === "darwin" ? ["open", url]
    : platform() === "win32" ? ["cmd", "/c", "start", "", url]
    : ["xdg-open", url];
  // Fire and forget — never block the UI on the spawn result.
  void run(cmd, { allowFail: true });
}

function urlFor(wt: Worktree | undefined): string | null {
  if (!wt) return null;
  return wt.pr?.url ?? wt.remoteUrl ?? null;
}

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
  state: number;
}

function computeWidths(terminalWidth: number): ColumnWidths {
  const usable = Math.max(40, terminalWidth - 4);
  const checkbox = 4; // "[✓] "
  const status = 15;
  const location = 12;
  const state = 8; // "*↑99↓99" worst-case-ish
  const remaining = Math.max(20, usable - checkbox - status - location - state - 4);
  const path = Math.floor(remaining * 0.55);
  return { checkbox, status, location, path, branch: remaining - path, state };
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
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width } = useTerminalDimensions();
  const widths = useMemo(() => computeWidths(width), [width]);

  const total = worktrees.length;

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 3500);
  };

  const toggle = (i: number) => {
    const wt = worktrees[i]!;
    if (isRowLocked(wt.status)) {
      showFlash(`🔒 Cannot delete the primary worktree — that would corrupt the repo.`);
      return;
    }
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
            (w, i) => isRowLocked(w.status) || prev.has(i),
          );
          if (allOn) return new Set();
          const next = new Set<number>();
          worktrees.forEach((w, i) => {
            if (!isRowLocked(w.status)) next.add(i);
          });
          return next;
        });
      case "d":
        return setSelected(new Set(initialSelected));
      case "o": {
        const url = urlFor(worktrees[cursor]);
        if (url) openExternal(url);
        return;
      }
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
            locked={isRowLocked(wt.status)}
          />
        ))}
      </scrollbox>
      <Detail wt={worktrees[cursor]} rootPath={rootPath} />
      <Footer flash={flash} />
    </box>
  );
}

function columnHeaders(w: ColumnWidths): string {
  return (
    "".padEnd(w.checkbox) +
    "STATUS".padEnd(w.status) +
    "LOC".padEnd(w.location) +
    "PATH".padEnd(w.path) +
    "BRANCH".padEnd(w.branch) +
    "STATE"
  );
}

function Header({
  total,
  selectedCount,
}: {
  total: number;
  selectedCount: number;
}): React.ReactNode {
  // flexShrink: 0 on every text — workaround for opentui issue #435 where
  // sibling text elements in a flex container shrink and overlap each other.
  return (
    <box
      style={{
        flexDirection: "column",
        borderStyle: "single",
        paddingLeft: 1,
        paddingRight: 1,
        flexShrink: 0,
      }}
    >
      <text style={{ flexShrink: 0 }}>
        <span fg={COLORS.headingFg} attributes={1}>worktree-cleanup</span>
        <span fg={COLORS.hintFg}>  ({selectedCount}/{total} selected)</span>
      </text>
      <box style={{ flexDirection: "row", flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.checkboxSelected} attributes={1}>
          {CHECKBOX.selected}
        </text>
        <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>{" delete   "}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.checkboxUnselected}>
          {CHECKBOX.unselected}
        </text>
        <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>{" keep   "}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.checkboxLocked}>{CHECKBOX.locked}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>{" locked   "}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.errorFg}>{"*"}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>{" dirty   "}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>{"↑N"}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>{" ahead   "}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>{"↓N"}</text>
        <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>{" behind"}</text>
      </box>
    </box>
  );
}

function Footer({ flash }: { flash: string | null }): React.ReactNode {
  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, paddingTop: 1, flexShrink: 0 }}>
      {flash ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.errorFg} attributes={1}>
          {flash}
        </text>
      ) : null}
      <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>
        ↑/↓ move · space toggle · a all · d reset · o open URL · enter confirm · q quit
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
  locked,
}: {
  wt: Worktree;
  onCursor: boolean;
  selected: boolean;
  rootPath: string;
  widths: ColumnWidths;
  locked: boolean;
}): React.ReactNode {
  const meta = STATUS_META[wt.status];
  const checkbox = locked
    ? CHECKBOX.locked
    : selected
      ? CHECKBOX.selected
      : CHECKBOX.unselected;
  const checkboxFg = onCursor
    ? COLORS.cursorFg
    : locked
      ? COLORS.checkboxLocked
      : selected
        ? COLORS.checkboxSelected
        : COLORS.checkboxUnselected;
  const checkboxAttrs = !onCursor && selected ? 1 : 0;
  const path = relPath(wt.path, rootPath);
  const branch = wt.branch ?? "(detached)";
  const state = stateFlags(wt);
  const rest =
    truncate(wt.status, widths.status - 1).padEnd(widths.status) +
    truncate(wt.location, widths.location - 1).padEnd(widths.location) +
    truncate(path, widths.path - 1).padEnd(widths.path) +
    truncate(branch, widths.branch - 1).padEnd(widths.branch);
  const restFg = onCursor
    ? COLORS.cursorFg
    : locked
      ? COLORS.disabledFg
      : meta.color;
  const stateFg = onCursor
    ? COLORS.cursorFg
    : wt.dirty
      ? COLORS.errorFg
      : COLORS.warningFg;
  return (
    <text bg={onCursor ? COLORS.cursorBg : "transparent"}>
      <span fg={checkboxFg} attributes={checkboxAttrs}>
        {checkbox.padEnd(widths.checkbox)}
      </span>
      <span fg={restFg}>{rest}</span>
      <span fg={stateFg} attributes={state && !onCursor ? 1 : 0}>
        {truncate(state, widths.state)}
      </span>
    </text>
  );
});

function Detail({
  wt,
  rootPath,
}: {
  wt: Worktree | undefined;
  rootPath: string;
}): React.ReactNode {
  if (!wt) return null;
  const locked = isRowLocked(wt.status);
  const willPromptForce = needsForceConfirm(wt);
  return (
    <box
      style={{
        flexDirection: "column",
        borderStyle: "single",
        paddingLeft: 1,
        paddingRight: 1,
        flexShrink: 0,
      }}
    >
      <text style={{ flexShrink: 0 }} fg={COLORS.headingFg} attributes={1}>
        {relPath(wt.path, rootPath)}
      </text>
      {locked ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.checkboxLocked} attributes={1}>
          🔒 LOCKED — {wt.reason}
        </text>
      ) : (
        <text style={{ flexShrink: 0 }} fg={COLORS.detailMuted}>reason: {wt.reason}</text>
      )}
      <text style={{ flexShrink: 0 }} fg={COLORS.detailMuted}>local:  {wt.path}</text>
      {/*
        Render URLs as plain text — not opentui's <a href>. Ghostty has a known
        bug (ghostty-org/ghostty#11907) where Cmd+Click on OSC 8 hyperlinks is
        ignored, but plain-text URLs go through its built-in URL matcher and DO
        open on Cmd+Click. iTerm2/WezTerm/Kitty/Alacritty all handle plain URLs
        the same way, so this is also the most portable option.
      */}
      <text style={{ flexShrink: 0 }} fg={wt.remoteUrl ? COLORS.detailMuted : COLORS.detailFainter}>
        remote: {wt.remoteUrl ?? "(not on origin)"}
      </text>
      {wt.pr ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.detailMuted}>
          PR #{wt.pr.number} {wt.pr.state} — {wt.pr.title}
        </text>
      ) : null}
      {wt.pr ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.detailMuted}>
          {wt.pr.url}
        </text>
      ) : null}
      {urlFor(wt) ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>
          press `o` to open this URL in your browser
        </text>
      ) : null}
      {wt.dirty ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.errorFg}>
          * uncommitted changes in this worktree
        </text>
      ) : null}
      {wt.ahead && wt.ahead > 0 ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>
          ↑ {wt.ahead} commit{wt.ahead === 1 ? "" : "s"} not pushed to upstream
        </text>
      ) : null}
      {wt.behind && wt.behind > 0 ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>
          ↓ {wt.behind} commit{wt.behind === 1 ? "" : "s"} behind upstream
        </text>
      ) : null}
      {!locked && willPromptForce ? (
        <text style={{ flexShrink: 0 }} fg={COLORS.warningFg}>
          ⚠ deleting this row will trigger an extra "are you sure?" prompt
        </text>
      ) : null}
    </box>
  );
}
