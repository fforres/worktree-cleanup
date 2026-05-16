import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { CliError, parseArgs } from "../src/cli.ts";
import { DEFAULT_PROTECTED } from "../src/protected.ts";

describe("parseArgs", () => {
  it("requires a positional path", () => {
    expect(() => parseArgs([])).toThrow(CliError);
    expect(() => parseArgs(["--no-fetch"])).toThrow(CliError);
  });

  it("resolves the path to an absolute path", () => {
    const { options } = parseArgs(["."]);
    expect(options.root).toBe(resolve("."));
  });

  it("accepts an absolute path verbatim", () => {
    const { options } = parseArgs(["/tmp/foo"]);
    expect(options.root).toBe("/tmp/foo");
  });

  it("returns sane defaults for the other options", () => {
    const { options, showHelp, showVersion, discoverOnly } = parseArgs(["."]);
    expect(showHelp).toBe(false);
    expect(showVersion).toBe(false);
    expect(discoverOnly).toBe(false);
    expect(options.fetch).toBe(true);
    expect(options.withPrs).toBe(true);
    expect(options.concurrency).toBeGreaterThan(0);
    expect(options.extraProtected).toEqual([...DEFAULT_PROTECTED]);
  });

  it("--help and --version do not require a path", () => {
    expect(parseArgs(["-h"]).showHelp).toBe(true);
    expect(parseArgs(["--help"]).showHelp).toBe(true);
    expect(parseArgs(["-v"]).showVersion).toBe(true);
    expect(parseArgs(["--version"]).showVersion).toBe(true);
  });

  it("--no-fetch and --no-prs", () => {
    const { options } = parseArgs([".", "--no-fetch", "--no-prs"]);
    expect(options.fetch).toBe(false);
    expect(options.withPrs).toBe(false);
  });

  it("--concurrency parses positive ints", () => {
    expect(parseArgs([".", "--concurrency", "10"]).options.concurrency).toBe(10);
    expect(() => parseArgs([".", "--concurrency", "-1"])).toThrow(CliError);
    expect(() => parseArgs([".", "--concurrency", "abc"])).toThrow(CliError);
    expect(() => parseArgs([".", "--concurrency", "3.5"])).toThrow(CliError);
    expect(() => parseArgs([".", "--concurrency", "0"])).toThrow(CliError);
  });

  it("--protect appends patterns", () => {
    const { options } = parseArgs([".", "--protect", "preview/**", "--protect", "hotfix"]);
    expect(options.extraProtected).toContain("preview/**");
    expect(options.extraProtected).toContain("hotfix");
    expect(options.extraProtected).toContain("main");
  });

  it("unknown flag throws CliError", () => {
    expect(() => parseArgs([".", "--banana"])).toThrow(CliError);
  });

  it("flag without required value throws CliError", () => {
    expect(() => parseArgs([".", "--concurrency"])).toThrow(CliError);
  });

  it("--discover-only flips the flag", () => {
    expect(parseArgs([".", "--discover-only"]).discoverOnly).toBe(true);
  });

  it("rejects a second positional argument", () => {
    expect(() => parseArgs([".", "/tmp/other"])).toThrow(CliError);
  });
});
