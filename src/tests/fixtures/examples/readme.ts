/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): UserResolver {
    return new UserResolver();
  }
  /**
   * @GQLField
   * @deprecated Please use `me` instead.
   */
  viewer(): UserResolver {
    return new UserResolver();
  }
}

/**
 * A user in our kick-ass system!
 * @GQLType User
 */
class UserResolver {
  /** @GQLField */
  name: string = "Alice";

  /** @GQLField */
  greeting(args: { salutation: string }): string {
    return `${args.salutation}, ${this.name()}`;
  }
}
