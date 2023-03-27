/** @gqlType */
export default class Query {
  /** @gqlField */
  me(): UserResolver {
    return new UserResolver();
  }
  /**
   * @gqlField
   * @deprecated Please use `me` instead.
   */
  viewer(): UserResolver {
    return new UserResolver();
  }
}

/**
 * A user in our kick-ass system!
 * @gqlType User
 */
class UserResolver {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(args: { salutation: string }): string {
    return `${args.salutation}, ${this.name}`;
  }
}

/** @gqlField */
export function getUser(_: Query): UserResolver {
  return new UserResolver();
}
