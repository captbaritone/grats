// {"EXPERIMENTAL__emitResolverMap": true, "strictSemanticNullability": true}

import { Int } from "../../../Types";

// `Post` and `User.greet` are resolved by GraphQL's default resolver without
// a semantic non-null check, so they're left out of the resolver map.

/** @gqlType */
class Post {
  /** @gqlField */
  title: string | null;
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField renamedProperty */
  someProperty: string;

  /** @gqlField */
  greet(args: { greeting: string }): string | null {
    return `${args.greeting}, ${this.name}!`;
  }

  /** @gqlField */
  posts: Post[];
}

/** @gqlField */
export function age(user: User): Int {
  return 42;
}

/** @gqlQueryField */
export function me(): User {
  return new User();
}
