import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROTECTED,
  compilePattern,
  isProtected,
} from "../src/protected.ts";

describe("compilePattern", () => {
  it("matches exact branch names", () => {
    expect(compilePattern("main").test("main")).toBe(true);
    expect(compilePattern("main").test("maintenance")).toBe(false);
  });

  it("treats * as non-slash glob", () => {
    const re = compilePattern("feature/*");
    expect(re.test("feature/foo")).toBe(true);
    expect(re.test("feature/foo/bar")).toBe(false);
  });

  it("treats ** as any-glob", () => {
    const re = compilePattern("release/**");
    expect(re.test("release/2026-04")).toBe(true);
    expect(re.test("release/hotfix/0001")).toBe(true);
    expect(re.test("not-release")).toBe(false);
  });

  it("escapes regex metacharacters in the pattern", () => {
    const re = compilePattern("release.v1");
    expect(re.test("release.v1")).toBe(true);
    expect(re.test("releaseXv1")).toBe(false); // '.' must be literal
  });
});

describe("compilePattern caching", () => {
  it("returns the same RegExp instance for the same pattern", () => {
    const a = compilePattern("feature/**");
    const b = compilePattern("feature/**");
    expect(a).toBe(b);
  });
});

describe("isProtected", () => {
  it("protects defaults", () => {
    for (const name of ["main", "master", "release", "release/2026-04", "develop", "production", "HEAD"]) {
      expect(isProtected(name)).toBe(true);
    }
  });

  it("does not protect arbitrary feature branches", () => {
    expect(isProtected("alice/my-branch")).toBe(false);
    expect(isProtected("feature/new-thing")).toBe(false);
  });

  it("respects custom protect patterns", () => {
    expect(isProtected("preview/foo", ["preview/**"])).toBe(true);
    expect(isProtected("preview", ["preview/**"])).toBe(false);
  });

  it("default list does not over-match", () => {
    // 'release/**' should match release/X but not random branches that
    // happen to contain "release" elsewhere.
    expect(isProtected("alice/release-backup", DEFAULT_PROTECTED)).toBe(false);
  });
});
