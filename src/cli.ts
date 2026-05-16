import { cpus } from "node:os";
import { resolve } from "node:path";
import { DEFAULT_PROTECTED } from "./protected.ts";
import { defaultConcurrency } from "./parallel.ts";
import type { AppOptions } from "./types.ts";

export interface ParsedArgs {
  options: AppOptions;
  showHelp: boolean;
  showVersion: boolean;
  discoverOnly: boolean;
}

const VERSION = "0.2.0";

export function helpText(): string {
  return `worktree-cleanup ${VERSION}

  Triage stale git worktrees with a full-screen TUI. Discovery is parallelized
  across CPUs; selection happens interactively; deletion is currently a no-op
  (the tool prints what it WOULD remove).

USAGE
  worktree-cleanup <path> [options]

  <path>                 Parent directory containing your worktrees. The
                         primary worktree must live at <path>/main. Use "."
                         for the current directory. Required.

OPTIONS
  --no-fetch             Skip 'git fetch --prune origin' before analysis.
  --no-prs               Skip PR-info lookups via 'gh'.
  --concurrency <N>      Parallel workers for git/gh subprocesses.
                         Default: (2 * cpu_count) - 1, clamped to 32.
  --protect <pattern>    Add a branch pattern to the protected list. Repeatable.
                         Patterns support '*' (non-slash) and '**' (any).
                         Defaults: ${DEFAULT_PROTECTED.join(", ")}
  --dry-run              Don't actually remove anything; print what would
                         happen. Recommended for first runs on a new folder.
  --discover-only        Print a JSON discovery report and exit. Useful for
                         piping or for verifying behavior in non-TTY envs.
  -h, --help             Show this help.
  -v, --version          Print version and exit.

EXAMPLES
  worktree-cleanup .
  worktree-cleanup ~/code/myproject
  worktree-cleanup . --no-fetch --no-prs
  worktree-cleanup . --protect 'preview/**'

KEY BINDINGS (in the table)
  ↑ / ↓                  Move cursor
  space                  Toggle selection on the current row
  a                      Toggle ALL rows
  d                      Reset to default selection
  o                      Open the current row's PR/remote URL in your browser
  enter                  Proceed to confirmation
  q / ctrl-c             Quit without doing anything
`;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const options: Omit<AppOptions, "root"> & { root: string | null } = {
    root: null,
    fetch: true,
    withPrs: true,
    concurrency: defaultConcurrency(cpus().length),
    extraProtected: [...DEFAULT_PROTECTED],
    dryRun: false,
  };
  let showHelp = false;
  let showVersion = false;
  let discoverOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "-h":
      case "--help":
        showHelp = true;
        break;
      case "-v":
      case "--version":
        showVersion = true;
        break;
      case "--no-fetch":
        options.fetch = false;
        break;
      case "--no-prs":
        options.withPrs = false;
        break;
      case "--concurrency": {
        const v = required(argv, ++i, "--concurrency");
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) {
          throw new CliError(`--concurrency must be a positive integer (got ${v})`);
        }
        options.concurrency = n;
        break;
      }
      case "--protect":
        options.extraProtected.push(required(argv, ++i, "--protect"));
        break;
      case "--discover-only":
        discoverOnly = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        if (a.startsWith("-")) {
          throw new CliError(`unknown argument: ${a}`);
        }
        if (options.root !== null) {
          throw new CliError(`unexpected positional argument: ${a} (root already set to ${options.root})`);
        }
        options.root = resolve(a);
    }
  }

  // Help/version are valid without a path.
  if (!showHelp && !showVersion && options.root === null) {
    throw new CliError("missing required <path> argument. Try: worktree-cleanup .");
  }

  return {
    options: { ...options, root: options.root ?? "" },
    showHelp,
    showVersion,
    discoverOnly,
  };
}

function required(argv: readonly string[], idx: number, flag: string): string {
  const v = argv[idx];
  if (v === undefined) throw new CliError(`${flag} requires a value`);
  return v;
}

export class CliError extends Error {}

export const __VERSION = VERSION;
