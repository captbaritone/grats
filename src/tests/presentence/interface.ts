/** @gqlType */
type Query = unknown;

/** @gqlField */
export function viewer(_: Query): Person {
  return new User();
}

/** @gqlInterface */
interface Person {
  /** @gqlField */
  name(foo: string | null): string;
}

/** @gqlType */
export class User implements Person {
  __typename = "User" as const;
  /** @gqlField */
  name(foo: string | null): string {
    return "Alice";
  }
}

/** @gqlType */
export class Admin implements Person {
  __typename = "Admin" as const;
  /** @gqlField */
  name(foo: string | null): string {
    return "Alice";
  }
}

export const operation = `
query {
  greeting
    viewer {
    name
  }
}`;
