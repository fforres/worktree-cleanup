import { run } from "./spawn.ts";

export interface PreflightResult {
  ok: boolean;
  /** Hard errors — the tool cannot run without these. */
  errors: string[];
  /** Soft warnings — the tool can run but some features are degraded. */
  warnings: string[];
}

export async function preflight(opts: {
  withPrs: boolean;
}): Promise<PreflightResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const git = await run(["git", "--version"], { allowFail: true });
  if (git.exit !== 0) {
    errors.push(
      "git not found on PATH. Install git: https://git-scm.com/downloads",
    );
  }

  if (opts.withPrs) {
    const gh = await run(["gh", "--version"], { allowFail: true });
    if (gh.exit !== 0) {
      warnings.push(
        "gh (GitHub CLI) not found on PATH. PR info will be unavailable. " +
          "Install: https://cli.github.com/  — or pass --no-prs to silence this.",
      );
    } else {
      const auth = await run(["gh", "auth", "status"], { allowFail: true });
      if (auth.exit !== 0) {
        warnings.push(
          "gh is installed but not authenticated. PR info will be unavailable. " +
            "Run `gh auth login` — or pass --no-prs to silence this.",
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
