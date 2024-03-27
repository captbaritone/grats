// { "strictSemanticNullability": true }

import { Int } from "../../..";

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function actuallyReturnsNull(_: Query): string {
  const empty: string[] = [];
  return empty[0]; // Oops!
}

/** @gqlField */
export async function actuallyReturnsAsyncNull(_: Query): Promise<string> {
  const empty: string[] = [];
  return empty[0]; // Oops!
}

/** @gqlField */
export function me(_: Query): User {
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

/** @gqlType */
type Subscription = unknown;

/** @gqlField */
export async function* names(_: Subscription): AsyncIterable<string> {
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
