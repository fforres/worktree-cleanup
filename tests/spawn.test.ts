import { describe, expect, it } from "vitest";
import { run } from "../src/spawn.ts";

describe("run", () => {
  it("returns exit=127 for missing binaries when allowFail is true", async () => {
    const r = await run(["this-binary-definitely-does-not-exist-12345"], {
      allowFail: true,
    });
    expect(r.exit).toBe(127);
    expect(r.stdout).toBe("");
    expect(r.stderr).toBe("");
  });

  it("propagates the throw for missing binaries without allowFail", async () => {
    await expect(
      run(["this-binary-definitely-does-not-exist-12345"]),
    ).rejects.toThrow();
  });
});
