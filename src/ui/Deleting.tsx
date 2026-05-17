import { useEffect, useState } from "react";
import type { DeleteOutcome } from "../delete.ts";
import type { Worktree } from "../types.ts";
import { COLORS, relPath } from "./util.ts";

export type ItemState =
  | { kind: "pending" }
  | { kind: "inProgress" }
  | { kind: "done"; outcome: DeleteOutcome };

interface Props {
  items: readonly Worktree[];
  statuses: readonly ItemState[];
  rootPath: string;
  concurrency: number;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Deleting({
  items,
  statuses,
  rootPath,
  concurrency,
}: Props): React.ReactNode {
  const frame = useSpinnerFrame();

  const finishedCount = statuses.filter((s) => s.kind === "done").length;
  const okCount = statuses.filter((s) => s.kind === "done" && s.outcome.ok).length;
  const failCount = finishedCount - okCount;
  const inFlightCount = statuses.filter((s) => s.kind === "inProgress").length;

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ borderStyle: "single", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.headingFg} attributes={1}>
          Deleting {items.length} worktree{items.length === 1 ? "" : "s"}…
          {"  "}
          <span fg={COLORS.warningFg}>⠿ {inFlightCount} in flight</span>
          {"  "}
          <span fg={COLORS.checkboxSelected}>✓ {okCount}</span>
          {"  "}
          <span fg={COLORS.errorFg}>✗ {failCount}</span>
          {"  "}
          <span fg={COLORS.hintFg}>{finishedCount}/{items.length}</span>
        </text>
      </box>
      <scrollbox style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1, paddingTop: 1 }}>
        {items.map((wt, i) => (
          <ItemRow
            key={wt.path}
            wt={wt}
            status={statuses[i]!}
            rootPath={rootPath}
            spinnerChar={SPINNER_FRAMES[frame]!}
          />
        ))}
      </scrollbox>
      <box style={{ borderStyle: "single", paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
        <text style={{ flexShrink: 0 }} fg={COLORS.hintFg}>
          Running in parallel · concurrency={concurrency} · each row reports start, finish, and any error independently.
        </text>
      </box>
    </box>
  );
}

function ItemRow({
  wt,
  status,
  rootPath,
  spinnerChar,
}: {
  wt: Worktree;
  status: ItemState;
  rootPath: string;
  spinnerChar: string;
}): React.ReactNode {
  const path = relPath(wt.path, rootPath);
  if (status.kind === "pending") {
    return (
      <text style={{ flexShrink: 0 }} fg={COLORS.detailFainter}>
        {"  ·  "}
        {path}
      </text>
    );
  }
  if (status.kind === "inProgress") {
    return (
      <text style={{ flexShrink: 0 }} fg={COLORS.warningFg} attributes={1}>
        {"  "}
        {spinnerChar}
        {"  "}
        {path}
      </text>
    );
  }
  const ok = status.outcome.ok;
  const mark = ok ? "✓" : "✗";
  const fg = ok ? COLORS.checkboxSelected : COLORS.errorFg;
  const tail = ok ? "" : ` — ${oneLine(status.outcome.message)}`;
  return (
    <text style={{ flexShrink: 0 }} fg={fg}>
      {"  "}
      {mark}
      {"  "}
      {path}
      {tail}
    </text>
  );
}

function oneLine(s: string): string {
  // git often emits multi-line errors; collapse so the row stays one line.
  return s.replace(/\s+/g, " ").trim();
}

function useSpinnerFrame(): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return frame;
}
