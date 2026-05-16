import { useRenderer } from "@opentui/react";
import { useEffect, useState } from "react";
import { performDeletes, type DeleteOutcome } from "../delete.ts";
import type { DiscoverResult } from "../discover.ts";
import type { Worktree } from "../types.ts";
import { Confirm } from "./Confirm.tsx";
import { Table } from "./Table.tsx";

type Phase =
  | { kind: "selecting" }
  | { kind: "confirming"; selected: Worktree[] }
  | { kind: "done"; outcomes: DeleteOutcome[]; cancelled?: boolean };

interface Props {
  result: DiscoverResult;
  dryRun: boolean;
  onExit: (final: Phase) => void;
}

export function App({ result, dryRun, onExit }: Props): React.ReactNode {
  const renderer = useRenderer();
  const [phase, setPhase] = useState<Phase>({ kind: "selecting" });
  const [initial] = useState<ReadonlySet<number>>(() => {
    const s = new Set<number>();
    result.worktrees.forEach((w, i) => {
      if (w.defaultSelected) s.add(i);
    });
    return s;
  });

  useEffect(() => {
    if (phase.kind !== "done") return;
    onExit(phase);
    setTimeout(() => renderer.destroy(), 10);
  }, [phase, renderer, onExit]);

  if (phase.kind === "selecting") {
    return (
      <Table
        worktrees={result.worktrees}
        initialSelected={initial}
        rootPath={result.root}
        onConfirm={(indices) => {
          const selected = result.worktrees.filter((_, i) => indices.has(i));
          setPhase(
            selected.length === 0
              ? { kind: "done", outcomes: [], cancelled: true }
              : { kind: "confirming", selected },
          );
        }}
        onQuit={() => setPhase({ kind: "done", outcomes: [], cancelled: true })}
      />
    );
  }

  if (phase.kind === "confirming") {
    return (
      <Confirm
        selected={phase.selected}
        rootPath={result.root}
        onConfirm={async () => {
          const outcomes = await performDeletes(phase.selected, { dryRun });
          setPhase({ kind: "done", outcomes });
        }}
        onCancel={() => setPhase({ kind: "done", outcomes: [], cancelled: true })}
      />
    );
  }

  return (
    <box style={{ padding: 1 }}>
      <text fg="#888">exiting…</text>
    </box>
  );
}
