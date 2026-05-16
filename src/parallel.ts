export async function pMap<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (concurrency < 1) throw new Error("concurrency must be >= 1");
  const out: R[] = new Array(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length || 1) },
    worker,
  );
  await Promise.all(workers);
  return out;
}

export function defaultConcurrency(cores: number): number {
  return Math.max(1, Math.min(32, 2 * cores - 1));
}
