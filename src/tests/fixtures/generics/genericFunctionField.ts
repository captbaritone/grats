/** @gqlType */
export class Page<T> {
  /** @gqlField */
  items: T[];
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;
}

/** @gqlType */
export class Post {
  /** @gqlField */
  title: string;
}

/** @gqlField */
export function first<T>(page: Page<T>): T | null {
  return page.items[0] ?? null;
}

/** @gqlQueryField */
export function users(): Page<User> {
  return new Page();
}

/** @gqlQueryField */
export function posts(): Page<Post> {
  return new Page();
}
