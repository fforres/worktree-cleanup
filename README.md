# worktree-cleanup

> Interactive TUI to triage and remove stale [git worktrees](https://git-scm.com/docs/git-worktree).

If you use `git worktree add` heavily — one worktree per feature/PR/agent task — you end up with dozens of stale directories whose branches are merged, deleted, abandoned, or still active. `worktree-cleanup` discovers all your worktrees in parallel, classifies each one by what's happening with its branch on GitHub, and lets you select which ones to remove from a full-screen checkbox table.

> [!IMPORTANT]
> **This tool only earns its keep when you have many worktrees in one parent folder.** If you have 1–3 worktrees you can manage by hand with `git worktree list` and `git worktree remove`. The TUI exists because triaging 50+ stale directories by hand is miserable and the "is this branch still relevant?" question has many possible answers.

---

## What it does

You point it at a directory that contains git worktrees (with the primary worktree at `<path>/main`), and for each one it answers:

| Status | Meaning | Default action |
|---|---|---|
| `REMOTE_DELETED` | Branch had upstream tracking; `origin/<branch>` no longer exists (merged & deleted) | ✅ Pre-selected for removal |
| `REMOTE_EXISTS` | Branch is still on GitHub. Annotated with PR number + state | ⬜ Skipped, flagged for review |
| `NEVER_PUSHED` | Branch has no upstream — likely WIP you haven't shared | ⬜ Skipped |
| `DETACHED` | Detached HEAD, no branch — hard to tell what's there | ⬜ Skipped |
| `PROTECTED` | Branch name matches `main`, `master`, `release/**`, `production`, `staging`, `develop`, `HEAD` (configurable via `--protect`) | 🔒 Locked, cannot be toggled |
| `MAIN_WORKTREE` | The primary worktree of the repo itself | 🔒 Locked |

It then opens a full-screen table where you can scroll, see PR/branch info per row, toggle selections with space, and confirm. Worktrees with uncommitted changes are flagged and skipped automatically.

## Screenshot

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ worktree-cleanup  (12/24 selected)                                           │
└──────────────────────────────────────────────────────────────────────────────┘
   STATUS         LOC         PATH                          BRANCH
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▪  MAIN_WORKTREE MAIN       main                          main               │
│ ■  REMOTE_DELETE FIRST_LAYE feat-login-form               feat/login-form    │
│ ■  REMOTE_DELETE FIRST_LAYE fix-cache-leak                fix/cache-leak     │
│ □  REMOTE_EXISTS FIRST_LAYE wip-import-wizard             wip/import-wizard  │
│ ■  REMOTE_DELETE FIRST_LAYE refactor-auth                 refactor/auth      │
│ □  NEVER_PUSHED  FIRST_LAYE experiment-a                  experiment-a       │
│ ■  REMOTE_DELETE FIRST_LAYE chore-bump-deps               chore/bump-deps    │
│ ...                                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ wip-import-wizard                                                            │
│ reason: origin/wip/import-wizard still exists on GitHub                      │
│ local:  /path/to/wip-import-wizard                                           │
│ remote: https://github.com/acme/widgets/tree/wip/import-wizard               │
│ PR #142 OPEN — Add CSV import wizard                                         │
└──────────────────────────────────────────────────────────────────────────────┘
 ↑/↓ move · space toggle · a all · d reset defaults · enter confirm · q quit
```

## Requirements

- **`git`** — must be on `PATH`. The tool exits with an error if it can't find git.
- **`gh`** (GitHub CLI) — *optional but recommended*. Used to enrich `REMOTE_EXISTS` rows with PR number/state/title. The tool prints a warning if `gh` is missing or unauthenticated; you can also pass `--no-prs` to skip the lookups entirely. Install: <https://cli.github.com/> · authenticate: `gh auth login`.
- **A parent folder containing your worktrees**, where `<path>/main` is your primary worktree (the one with the actual `.git` directory). This is the convention `git worktree add` follows when you create a worktree in a sibling directory.

The tool itself ships either as a standalone binary (no Bun required) or as Bun-runnable source — see *Install* below.

## Install

### Option 1 — Standalone binary (recommended for most users)

Download from the [Releases](https://github.com/fforres/worktree-cleanup/releases) page and put it on your `PATH`:

```sh
# macOS arm64 example
curl -fsSL https://github.com/fforres/worktree-cleanup/releases/latest/download/worktree-cleanup-darwin-arm64 \
  -o /usr/local/bin/worktree-cleanup
chmod +x /usr/local/bin/worktree-cleanup
```

The binary is ~65 MB and bundles Bun + native libraries — no other runtime required.

### Option 2 — From source with Bun

If you have [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`):

```sh
git clone https://github.com/fforres/worktree-cleanup.git
cd worktree-cleanup
bun install
bun run install:local   # builds the binary, copies it to ~/.local/bin
```

Make sure `~/.local/bin` is on your `PATH`. Or run directly without installing:

```sh
bun run start -- . --help
```

### Option 3 — One-off via `bunx`

```sh
bunx worktree-cleanup . --help
```

## Usage

```sh
worktree-cleanup <path> [options]
```

The first positional argument is the parent directory containing your worktrees. It's **required** — there is no default. Pass `.` for the current directory.

Common flags:

| Flag | Purpose |
|---|---|
| `--no-fetch` | Skip `git fetch --prune origin` (use cached remote state) |
| `--no-prs` | Skip PR-info lookups via `gh` |
| `--concurrency <N>` | Parallel git/gh subprocesses. Default: `min(32, 2 * cores - 1)` |
| `--protect <pattern>` | Add a branch pattern to the protected list. Repeatable. Supports `*` (non-slash) and `**` (any). |
| `--discover-only` | Print a JSON report and exit. Useful for piping to `jq` or CI. |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Print version |

Key bindings inside the TUI:

| Key | Action |
|---|---|
| `↑` / `↓` (or `j` / `k`) | Move cursor |
| `pgup` / `pgdn` | Jump 10 rows |
| `g` / `G` | Jump to top / bottom |
| `space` | Toggle selection on the current row |
| `a` | Toggle ALL toggleable rows |
| `d` | Reset to default preselection |
| `enter` | Proceed to confirmation |
| `q` / `esc` / `ctrl-c` | Quit |

### Examples

Triage the current directory:

```sh
worktree-cleanup .
```

Fast pass on cached state (no network):

```sh
worktree-cleanup . --no-fetch --no-prs
```

Triage a different folder:

```sh
worktree-cleanup ~/code/myproject
```

Protect additional branch prefixes (e.g. preview environments):

```sh
worktree-cleanup . --protect 'preview/**' --protect 'hotfix-*'
```

Dump a JSON report for tooling:

```sh
worktree-cleanup . --discover-only --no-fetch | jq 'group_by(.status) | map({status: .[0].status, count: length})'
```

## Safety

The current build is intentionally **conservative**:

- The actual delete step is a no-op. After confirmation, it prints `[noop] WOULD run: git worktree remove …` lines instead of running them. To turn it on, edit `src/delete.ts` — that is the only place that needs to change. (This is so the tool is safe to try on real repos before you trust it.)
- **Local branches are never deleted** — only the worktree directory. `git worktree remove` does not touch `refs/heads/<branch>`, so resurrecting a worktree is `git worktree add <path> <branch>` away.
- **Dirty worktrees are skipped**. The tool refuses to pass `--force` to `git worktree remove`; if there are uncommitted changes, the row is flagged with `*` and the message says `WOULD refuse to remove`.
- **Protected branches cannot be toggled**. The checkbox renders as `▪` and the `space` key is a no-op on those rows.

## How "REMOTE_DELETED" is decided

To classify a branch as "the remote has been deleted, you can safely remove this worktree", **both** conditions must hold:

1. Git has a `branch.<name>.remote` config entry — i.e. the branch was pushed at some point.
2. `origin/<name>` does not exist after `git fetch --prune`.

If condition 1 is missing the branch is classified as `NEVER_PUSHED` and is *not* preselected, because that's usually local-only WIP you haven't shared.

## Performance

On a 14-core machine, against a repo with ~90 worktrees and ~230 remote branches:

| Mode | Time |
|---|---|
| `--no-fetch --no-prs` | ~1 s (local-only, no network) |
| `--no-fetch` (PR lookups via gh) | ~2.5 s (gated by gh rate limits) |
| Default (fetch + PRs) | ~3–4 s |

Subprocess work is dispatched across `2 * cores - 1` workers; the `git config` calls are coalesced into a single `--get-regexp` invocation.

## Development

```sh
bun install
bun run test       # vitest, 49+ tests for the pure logic
bun run typecheck  # tsc --noEmit, strict
bun run dev -- . --discover-only --no-fetch   # run from source
bun run build      # produce dist/worktree-cleanup standalone binary
```

See [`AGENTS.md`](./AGENTS.md) for repository conventions.

## License

[MIT](./LICENSE)
