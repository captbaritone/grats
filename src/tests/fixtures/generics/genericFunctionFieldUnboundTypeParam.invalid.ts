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

/** `U` isn't one of `Page`'s type arguments, so nothing says what it is. @gqlField */
export function other<T, U>(page: Page<T>): U | null {
  return null;
}

/** @gqlQueryField */
export function users(): Page<User> {
  return new Page();
}
