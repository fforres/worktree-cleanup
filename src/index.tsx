#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { CliError, helpText, parseArgs, __VERSION } from "./cli.ts";
import { discover } from "./discover.ts";
import { preflight } from "./preflight.ts";
import { App } from "./ui/App.tsx";
import type { DeleteOutcome } from "./delete.ts";

/**
 * Extract user args from process.argv, working around a Bun quirk in compiled
 * binaries: when invoked with zero user args, Bun injects the invocation path
 * (== process.argv0) as argv[2], which would otherwise be mistaken for a
 * positional argument. See https://github.com/oven-sh/bun/issues for context.
 */
function userArgs(): string[] {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === process.argv0) return [];
  return args;
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs(userArgs());
  } catch (err) {
    if (err instanceof CliError) {
      process.stderr.write(`${err.message}\n\n${helpText()}`);
      process.exit(2);
    }
    throw err;
  }

  if (parsed.showHelp) {
    process.stdout.write(helpText());
    return;
  }
  if (parsed.showVersion) {
    process.stdout.write(`worktree-cleanup ${__VERSION}\n`);
    return;
  }

  const { options } = parsed;

  const pre = await preflight({ withPrs: options.withPrs });
  for (const w of pre.warnings) process.stderr.write(`warning: ${w}\n`);
  if (!pre.ok) {
    for (const e of pre.errors) process.stderr.write(`error: ${e}\n`);
    process.exit(1);
  }

  process.stdout.write(`worktree-cleanup ${__VERSION}\n`);
  process.stdout.write(`root: ${options.root}\n`);
  process.stdout.write(`concurrency: ${options.concurrency}\n`);
  const t0 = Date.now();
  let result;
  try {
    result = await discover(options, (msg) => {
      process.stdout.write(`  • ${msg}\n`);
    });
  } catch (err) {
    process.stderr.write(`discovery failed: ${(err as Error).message}\n`);
    process.exit(1);
  }
  process.stdout.write(
    `discovered ${result.worktrees.length} worktrees in ${Date.now() - t0}ms\n\n`,
  );

  if (parsed.discoverOnly) {
    process.stdout.write(JSON.stringify(result.worktrees, null, 2) + "\n");
    return;
  }

  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  let finalOutcomes: DeleteOutcome[] = [];
  let cancelled = false;
  let exited = false;

  await new Promise<void>((resolve) => {
    createRoot(renderer).render(
      <App
        result={result}
        onExit={(phase) => {
          if (exited) return;
          exited = true;
          if (phase.kind === "done") {
            finalOutcomes = phase.outcomes;
            cancelled = phase.cancelled ?? false;
          }
          setTimeout(resolve, 20);
        }}
      />,
    );
  });

  if (cancelled || finalOutcomes.length === 0) {
    process.stdout.write("\nNothing selected. Exiting.\n");
    return;
  }
  process.stdout.write(`\nResults (${finalOutcomes.length}):\n`);
  for (const o of finalOutcomes) {
    process.stdout.write(`  ${o.message}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`error: ${err?.stack ?? String(err)}\n`);
  process.exit(1);
});
