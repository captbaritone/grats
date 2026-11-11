/** @gqlInterface */
export interface Box<T> {
  /** @gqlField */
  value: T;
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;
}

/** @gqlField */
export function unwrap<T>(box: Box<T>): T {
  return box.value;
}

/** @gqlQueryField */
export function box(): Box<User> {
  return { value: new User() };
}
