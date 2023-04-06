/** @gqlType */
export default class Query {
  /** @gqlField */
  me(): User {
    return new User();
  }
  /**
   * @gqlField
   * @deprecated Please use `me` instead. */
  viewer(): User {
    return new User();
  }
}

/**
 * A user in our kick-ass system!
 * @gqlType */
class User {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(args: { salutation: string }): string {
    return `${args.salutation}, ${this.name}`;
  }
}
