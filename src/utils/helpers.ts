export class DefaultMap<K, V> {
  _map: Map<K, V> = new Map();
  constructor(private readonly getDefault: () => V) {}

  get(key: K): V {
    if (!this._map.has(key)) {
      this._map.set(key, this.getDefault());
    }
    return this._map.get(key)!;
  }
}

// Similar to a.push(...b), but avoids potential stack overflows.
export function extend<T>(a: T[], b: readonly T[]) {
  for (const item of b) {
    a.push(item);
  }
}

export function astNode<T>(item: { astNode?: T | undefined | null }): T {
  if (item.astNode == null) {
    throw new Error("Expected item to have astNode");
  }
  return item.astNode;
}

let i = 0;
export function uniqueId() {
  return i++;
}

export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      `Grats Error. Invariant failed: ${message}. This error represents an error in Grats. Please report it.`,
    );
  }
}

export function nullThrows<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error(
      "Grats Error. Expected value to be non-nullish. This error represents an error in Grats. Please report it.",
    );
  }
  return value;
}

// Predicate function for filtering out null values
// Includes TypeScript refinement for narrowing the type
export function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

// Chat GPT Converted the Wikipedia pseudocode to TypeScript
export function levenshteinDistance(s: string, t: string): number {
  const m = s.length;
  const n = t.length;

  // 2D array (m+1) x (n+1)
  const d: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  // source prefixes → empty string
  for (let i = 1; i <= m; i++) {
    d[i][0] = i;
  }

  // empty source prefix → target prefixes
  for (let j = 1; j <= n; j++) {
    d[0][j] = j;
  }

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const substitutionCost = s[i - 1] === t[j - 1] ? 0 : 1;

      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + substitutionCost, // substitution
      );
    }
  }

  const distance = d[m][n];
  return distance;
}

// Sorts an array IN PLACE by a computed key
export function bestMatch<T>(
  arr: readonly T[],
  scoreFn: (item: T) => number,
): T {
  return arr.reduce(
    (best, item) =>
      best == null || scoreFn(item) > scoreFn(best) ? item : best,
    arr[0],
  );
}
