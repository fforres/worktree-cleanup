import { describe, expect, it } from "vitest";
import { defaultConcurrency, pMap } from "../src/parallel.ts";

describe("defaultConcurrency", () => {
  it("returns 2*cores - 1", () => {
    expect(defaultConcurrency(8)).toBe(15);
    expect(defaultConcurrency(4)).toBe(7);
    expect(defaultConcurrency(14)).toBe(27);
  });
  it("clamps to >= 1 for tiny machines", () => {
    expect(defaultConcurrency(0)).toBe(1);
    expect(defaultConcurrency(1)).toBe(1);
  });
  it("clamps to <= 32 for huge machines", () => {
    expect(defaultConcurrency(64)).toBe(32);
  });
});

describe("pMap", () => {
  it("returns results in input order", async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await pMap(items, 2, async (n) => n * n);
    expect(result).toEqual([1, 4, 9, 16, 25]);
  });

  it("never runs more than `concurrency` tasks at once", async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 50 }, (_, i) => i);
    await pMap(items, 5, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it("handles an empty input array", async () => {
    const result = await pMap([], 4, async (x: number) => x);
    expect(result).toEqual([]);
  });

  it("throws on invalid concurrency", async () => {
    await expect(pMap([1], 0, async (x) => x)).rejects.toThrow(/>= 1/);
  });
});
