/** `T` is never used in a GraphQL position, so `Page` isn't generic. @gqlType */
export class Page<T> {
  /** @gqlField */
  count: string;
  items: T[];
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;
}

/** @gqlField */
export function first<T>(page: Page<T>): T | null {
  return null;
}

/** @gqlQueryField */
export function users(): Page<User> {
  return new Page();
}
