export class DefaultMap<K, V> {
  _map: Map<K, V> = new Map();
  constructor(private readonly getDefault: () => V) {}

  get(key: K): V {
    if (!this._map.has(key)) {
      this._map.set(key, this.getDefault());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._map.get(key)!;
  }
}

// Similar to a.push(...b), but avoids potential stack overflows.
export function extend<T>(a: T[], b: readonly T[]) {
  for (const item of b) {
    a.push(item);
  }
}

// Typesafe filter predicate to filter out null and undefined.
export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
