/** @gqlType */
type Query = unknown;

/** @gqlField */
export function me(_: Query): User {
  return new User();
}
/**
 * @gqlField
 * @deprecated Please use `me` instead. */
export function viewer(_: Query): User {
  return new User();
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
