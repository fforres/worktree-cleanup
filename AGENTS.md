# AGENTS.md — instructions for agents working in this repo

This file tells an AI agent (or a contributor in a hurry) how to build, test, and extend `worktree-cleanup` without re-deriving the project's conventions from scratch.

It does **not** restate things that are already obvious from the source. Read the file in question first; come back here only for the rules that aren't on a line of code somewhere.

## Runtime

- **This project runs on [Bun](https://bun.sh), not Node.** `@opentui/core` has a hard dependency on `bun-ffi-structs`. Do not introduce code or scripts that assume Node-only APIs at runtime. (Vitest is the exception — see below.)
- Verify Bun is available: `bun --version` (require `>=1.1`).
- The bin launcher `bin/worktree-cleanup` is a tiny bash script that execs `bun run src/index.tsx`. The shipped binary is produced by `bun build --compile`.

## Standard workflows

```sh
bun install
bun run typecheck   # tsc --noEmit, must be clean before committing
bun run test        # vitest, must be green before committing
bun run dev -- --help
bun run build       # produces dist/worktree-cleanup (~65 MB single-file binary)
```

When you change source, run **typecheck and test** before declaring done. If you touched the UI specifically, also smoke-test the discovery path so you don't break it accidentally:

```sh
bun run dev -- --discover-only --no-fetch --no-prs | head
```

## Repository layout (1-line per module)

```
src/
  index.tsx       entrypoint: parseArgs → preflight → discover → render TUI → post-TUI report
  cli.ts          arg parsing + helpText(). Adding a flag means: parse here, document in helpText, add a test in tests/cli.test.ts
  preflight.ts    hard checks (git) + soft warnings (gh). Errors abort; warnings go to stderr and continue.
  types.ts        the shared Worktree/Status/Location/PrInfo shapes; everything else imports from here
  protected.ts    DEFAULT_PROTECTED list + glob-to-regex compiler (with cache)
  parallel.ts     pMap + defaultConcurrency
  spawn.ts        thin Bun.spawn wrapper. ALL subprocess calls go through this — do not call Bun.spawn directly elsewhere
  git.ts          git CLI wrappers built on spawn.ts
  github.ts       gh CLI wrappers + branchUrl()
  classify.ts     pure classification (status + reason + defaultSelected) and locationOf() + isImmutable()
  discover.ts     orchestrates: 1 fetch, 1 ls-worktrees, 1 for-each-ref, 1 config --get-regexp, then pMap over worktrees
  delete.ts       performDeletes — currently NO-OP. See "Safety" below.
  ui/
    App.tsx       state machine: selecting → confirming → done
    Table.tsx     full-screen checkbox table; Row is React.memo'ed
    Confirm.tsx   confirmation modal
    util.ts       SHARED across ui/*: STATUS_META (color + immutable), COLORS palette, relPath(), truncate()
tests/            vitest, one file per pure module; never test the TUI components — test the logic feeding them
```

## Conventions

### Subprocess calls

- Use `run()` from `src/spawn.ts`. Don't reach for `Bun.spawn`/`child_process.execFile` directly.
- For "expected to fail" calls (e.g. `git config --get` that returns 1 when missing), pass `allowFail: true` and check `exit`.

### Adding a new branch status

Status is a string-union in `src/types.ts`. To add one:

1. Add the variant to `Status` in `types.ts`.
2. Add a case in `classify()` in `src/classify.ts`.
3. Add an entry to `STATUS_META` in `src/ui/util.ts` (the **single source of truth** for color + immutability).
4. Add a test in `tests/classify.test.ts`.

Do not hardcode status-specific behavior anywhere else.

### Adding a CLI flag

1. Parse it in `parseArgs()` (`src/cli.ts`).
2. Document it in `helpText()` (same file).
3. Add a test case in `tests/cli.test.ts`.

If the flag affects discovery, plumb it through `AppOptions` in `types.ts`; if it only affects the entrypoint, keep it in `ParsedArgs`.

### UI

- All colors come from `COLORS` / `STATUS_META` in `src/ui/util.ts`. Don't sprinkle hex literals into components.
- `@opentui/react` uses **lowercase JSX intrinsics**: `<box>`, `<text>`, `<scrollbox>`, `<select>`. Capitalized identifiers mean React components. `tsconfig.json` sets `jsxImportSource: "@opentui/react"` to make this work.
- `Row` in `Table.tsx` is `React.memo`-wrapped. Don't pass it unstable props (closures, new objects per render) without rethinking the memoization.
- Layout is flex-based (Yoga). When a `<box>` adds no layout value, delete it.

### Tests

- Tests run under **Node + Vitest**, not Bun. The pure modules (`classify`, `protected`, `parallel`, `cli`, `delete`, `github`) are written to be runtime-agnostic so they can be tested without standing up the TUI or spawning subprocesses.
- Do **not** import `@opentui/*`, `react`, or `Bun.*` from a test file. If you need to test something that touches those, either extract the testable bit into a pure helper or write a smoke script (see `--discover-only` for an example pattern).

### Comments

- Keep comments minimal. Don't restate what the code already says; document only non-obvious *why* (constraints, invariants, workarounds).
- No JSDoc paragraphs on internal helpers. Public-ish entrypoints in `src/types.ts` and `src/cli.ts` can have one-line `/** */` summaries where it actually helps a caller.

## Safety contract

`src/delete.ts::performDeletes` runs `git worktree remove <path>` for real by default. Two non-negotiable guards must stay in place:

1. **Dirty trees are never removed.** We refuse to pass `--force`. If `wt.dirty` is true the row is skipped before any subprocess is spawned. If you ever consider passing `--force`, that's a separate, explicit user-facing flag — never the default.
2. **`--dry-run` always works as a no-op preview.** `performDeletes(items, { dryRun: true })` must never spawn anything. The flag is parsed in `cli.ts`, threaded through `AppOptions.dryRun` and `App` props, and ends in the call site inside `App.tsx`. Don't shortcut around it.

Removing or weakening either guard is a breaking change — bump version and update README + this file before merging.

## Distribution

Two channels:

- **GitHub Releases**: prebuilt `bun build --compile` binaries per OS/arch. Built by `bun run build`. Single self-contained file, ~65 MB, includes Bun + Zig native libs.
- **npm**: source distribution. Users install via `bun add -g worktree-cleanup` (or `bunx worktree-cleanup`). The `files` allowlist in `package.json` controls what gets published; keep it minimal.

If you change the public surface (flags, exit codes, output format), bump the version per semver and update both `package.json` and `src/cli.ts::VERSION`.

## Things that have bitten us before

- **opentui flex containers shrink text children by default.** When you put multiple `<text>` (or `<box>` with a single `<text>`) elements in a flex parent, they'll overlap when the parent doesn't have enough room. Always set `style={{ flexShrink: 0 }}` on text nodes inside a flex column/row whose total content height/width approaches the container size. Tracking: [opentui#435](https://github.com/anomalyco/opentui/issues/435).

- **Lowercase `<text>` / `<box>` are intrinsics, not React components.** Capitalizing them silently routes through `React.createElement("Text", …)` which renders as nothing.
- **Bun's `Response(proc.stdout).text()` must be awaited together with `proc.exited`** — not after. Sequentially awaiting blocks on `proc.exited` first which can deadlock if the child writes more than a pipe buffer. See `src/spawn.ts` for the `Promise.all` pattern that gets it right.
- **`tsconfig.json` sets `noUncheckedIndexedAccess`.** Array/Set access returns `T | undefined`. Don't add non-null assertions blindly; check existence or use `at()` with care.
- **`@opentui/core` ships native binaries.** `bun install --frozen-lockfile` is the right command for CI; don't `npm install`.

## When you're unsure

Read the file you're editing, then check the test next to it. If the test is silent about the behavior you're changing, add one before you change anything else.
