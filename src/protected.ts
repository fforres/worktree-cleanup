export const DEFAULT_PROTECTED: readonly string[] = [
  "main",
  "master",
  "release",
  "release/**",
  "production",
  "prod",
  "staging",
  "stage",
  "develop",
  "development",
  "HEAD",
];

const CACHE = new Map<string, RegExp>();

export function compilePattern(pattern: string): RegExp {
  const cached = CACHE.get(pattern);
  if (cached) return cached;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withGlobs = escaped
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");
  const re = new RegExp(`^${withGlobs}$`);
  CACHE.set(pattern, re);
  return re;
}

export function isProtected(
  branch: string,
  patterns: readonly string[] = DEFAULT_PROTECTED,
): boolean {
  return patterns.some((p) => compilePattern(p).test(branch));
}
