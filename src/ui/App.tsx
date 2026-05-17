import { useRenderer } from "@opentui/react";
import { useEffect, useRef, useState } from "react";
import { performDeletes, type DeleteOutcome } from "../delete.ts";
import type { DiscoverResult } from "../discover.ts";
import type { Worktree } from "../types.ts";
import { Confirm } from "./Confirm.tsx";
import { ConfirmForce } from "./ConfirmForce.tsx";
import { Deleting, type ItemState } from "./Deleting.tsx";
import { Table } from "./Table.tsx";
import { needsForceConfirm } from "./util.ts";

type Phase =
  | { kind: "selecting"; preserved?: ReadonlySet<number> }
  | { kind: "confirming"; selected: Worktree[]; indices: ReadonlySet<number> }
  | {
      kind: "forceConfirming";
      selected: Worktree[];
      indices: ReadonlySet<number>;
      forceRequired: Worktree[];
      safe: Worktree[];
    }
  | { kind: "deleting"; items: Worktree[]; statuses: ItemState[] }
  | { kind: "done"; outcomes: DeleteOutcome[]; cancelled?: boolean };

interface Props {
  result: DiscoverResult;
  dryRun: boolean;
  deleteConcurrency: number;
  onExit: (final: Phase) => void;
}

export function App({ result, dryRun, deleteConcurrency, onExit }: Props): React.ReactNode {
  const renderer = useRenderer();
  const [phase, setPhase] = useState<Phase>({ kind: "selecting" });
  // Statuses live in a ref so the delete callback can mutate without depending
  // on stale phase closures; the ref drives state updates by replacing the
  // whole array (so React notices) on every event.
  const statusesRef = useRef<ItemState[]>([]);
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

  const runDelete = async (items: Worktree[], force: boolean) => {
    const initialStatuses: ItemState[] = items.map(() => ({ kind: "pending" }));
    statusesRef.current = initialStatuses;
    setPhase({ kind: "deleting", items, statuses: initialStatuses });

    const outcomes = await performDeletes(items, {
      dryRun,
      force,
      cwd: result.mainWt,
      concurrency: deleteConcurrency,
      onEvent: (e) => {
        const next = statusesRef.current.slice();
        if (e.kind === "start") {
          next[e.index] = { kind: "inProgress" };
        } else {
          next[e.index] = { kind: "done", outcome: e.outcome };
        }
        statusesRef.current = next;
        setPhase({ kind: "deleting", items, statuses: next });
      },
    });
    setPhase({ kind: "done", outcomes });
  };

  if (phase.kind === "selecting") {
    return (
      <Table
        worktrees={result.worktrees}
        initialSelected={phase.preserved ?? initial}
        rootPath={result.root}
        onConfirm={(indices) => {
          const selected = result.worktrees.filter((_, i) => indices.has(i));
          setPhase(
            selected.length === 0
              ? { kind: "done", outcomes: [], cancelled: true }
              : { kind: "confirming", selected, indices },
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
        onConfirm={() => {
          const forceRequired = phase.selected.filter(needsForceConfirm);
          if (forceRequired.length === 0) {
            void runDelete(phase.selected, false);
            return;
          }
          const safe = phase.selected.filter((w) => !needsForceConfirm(w));
          setPhase({
            kind: "forceConfirming",
            selected: phase.selected,
            indices: phase.indices,
            forceRequired,
            safe,
          });
        }}
        onBack={() => setPhase({ kind: "selecting", preserved: phase.indices })}
        onCancel={() => setPhase({ kind: "done", outcomes: [], cancelled: true })}
      />
    );
  }

  if (phase.kind === "forceConfirming") {
    return (
      <ConfirmForce
        forceRequired={phase.forceRequired}
        safeCount={phase.safe.length}
        rootPath={result.root}
        onConfirmAll={() => void runDelete(phase.selected, true)}
        onSafeOnly={() => void runDelete(phase.safe, false)}
        onCancel={() => setPhase({ kind: "done", outcomes: [], cancelled: true })}
      />
    );
  }

  if (phase.kind === "deleting") {
    return (
      <Deleting
        items={phase.items}
        statuses={phase.statuses}
        rootPath={result.root}
        concurrency={deleteConcurrency}
      />
    );
  }

  return (
    <box style={{ padding: 1 }}>
      <text fg="#888">exiting…</text>
    </box>
  );
}
