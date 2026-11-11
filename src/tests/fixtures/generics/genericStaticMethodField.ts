/** @gqlType */
export class Page<T> {
  /** @gqlField */
  items: T[];
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  static firstOf<T>(page: Page<T>): T | null {
    return page.items[0] ?? null;
  }
}

/** @gqlQueryField */
export function users(): Page<User> {
  return new Page();
}
