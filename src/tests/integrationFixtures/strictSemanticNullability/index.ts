// { "strictSemanticNullability": true }

/** @gqlQueryField */
export function actuallyReturnsNull(): string {
  const empty: string[] = [];
  return empty[0]; // Oops!
}

/** @gqlQueryField */
export async function actuallyReturnsAsyncNull(): Promise<string> {
  const empty: string[] = [];
  return empty[0]; // Oops!
}

/** @gqlQueryField */
export function me(): User {
  const empty: string[] = [];
  return new User(empty[0]);
}

/** @gqlInterface */
interface IPerson {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements IPerson {
  __typename = "User" as const;
  constructor(name: string) {
    this.name = name;
    this.alsoName = name;
  }
  /** @gqlField */
  name: string;

  /** @gqlField notName */
  alsoName: string;
}

/** @gqlSubscriptionField */
export async function* names(): AsyncIterable<string> {
  const empty: string[] = [];
  yield empty[0]; // Oops!
}

// All of these should result in an error
export const query = `
  query {
    actuallyReturnsNull
    actuallyReturnsAsyncNull
    me {
      name
      notName
    }
  }
`;
