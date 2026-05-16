import { describe, expect, it } from "vitest";
import { branchUrl } from "../src/github.ts";

describe("branchUrl", () => {
  it("parses SSH remotes", () => {
    expect(branchUrl("git@github.com:acme/widgets.git", "main")).toBe(
      "https://github.com/acme/widgets/tree/main",
    );
  });
  it("parses HTTPS remotes (with .git)", () => {
    expect(branchUrl("https://github.com/foo/bar.git", "feat")).toBe(
      "https://github.com/foo/bar/tree/feat",
    );
  });
  it("parses HTTPS remotes (without .git)", () => {
    expect(branchUrl("https://github.com/foo/bar", "feat")).toBe(
      "https://github.com/foo/bar/tree/feat",
    );
  });
  it("URL-encodes the branch", () => {
    expect(branchUrl("git@github.com:foo/bar.git", "feat/foo bar")).toBe(
      "https://github.com/foo/bar/tree/feat%2Ffoo%20bar",
    );
  });
  it("returns null for non-GitHub remotes", () => {
    expect(branchUrl("git@gitlab.com:foo/bar.git", "main")).toBeNull();
  });
});
