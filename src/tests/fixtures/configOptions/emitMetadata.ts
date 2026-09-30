// {"EXPERIMENTAL__emitMetadata": true}

import { GqlInfo, Int } from "../../../Types";

/** @gqlContext */
type RootContext = {
  userName: string;
};

type DerivedContext = {
  greeting: string;
};

/** @gqlContext */
export async function createDerivedContext(
  ctx: RootContext,
): Promise<DerivedContext> {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField renamedProperty */
  someProperty: string;

  /** @gqlField */
  greet(args: { greeting: string }, ctx: RootContext, info: GqlInfo): string {
    return `${args.greeting}, ${this.name}!`;
  }

  /** @gqlField renamedMethod */
  someMethod(): string {
    return this.name;
  }

  /** @gqlQueryField */
  static allUsers(): User[] {
    return [];
  }
}

/** @gqlField */
export function age(
  user: User,
  offset: Int,
  derived: DerivedContext,
  ctx: RootContext,
): Int {
  return offset;
}

/** @gqlQueryField */
export default function me(): User {
  return new User();
}
