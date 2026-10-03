/** @gqlType */
type Page<T> = {
  /** @gqlField */
  items: T[];
};

/** @gqlField */
export function first<T>(page: Page<T>): T | null {
  return page.items[0] ?? null;
}

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlQueryField */
export function users(): Page<User> {
  return { items: [] };
}
