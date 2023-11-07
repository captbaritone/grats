/** @gqlType */
export type Query = unknown;

/** @gqlField */
export function me(_: Query): UserResolver {
  return new UserResolver();
}
/**
 * @gqlField
 * @deprecated Please use `me` instead.
 */
export function viewer(_: Query): UserResolver {
  return new UserResolver();
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
