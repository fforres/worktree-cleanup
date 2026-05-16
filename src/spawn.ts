export interface RunOptions {
  cwd?: string;
  allowFail?: boolean;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exit: number;
}

export async function run(
  cmd: readonly string[],
  opts: RunOptions = {},
): Promise<RunResult> {
  const spawnOpts = {
    cwd: opts.cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  } as const;
  // Bun.spawn throws synchronously when the binary is not on PATH.
  // Normalize to exit=127 so callers using allowFail can treat it
  // uniformly with non-zero exits.
  let proc;
  try {
    proc = Bun.spawn(cmd as string[], spawnOpts);
  } catch (err) {
    if (opts.allowFail) return { stdout: "", stderr: "", exit: 127 };
    throw err;
  }
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout as ReadableStream).text(),
    new Response(proc.stderr as ReadableStream).text(),
    proc.exited,
  ]);
  if (exit !== 0 && !opts.allowFail) {
    throw new Error(`${cmd.join(" ")} exited ${exit}: ${stderr.trim()}`);
  }
  return { stdout: stdout.trim(), stderr: stderr.trim(), exit };
}
