/** @gqlQueryField */
export function me(): User {
  return new User();
}

/**
 * @gqlQueryField
 * @deprecated Please use `me` instead. */
export function viewer(): User {
  return new User();
}

/**
 * A user in our kick-ass system!
 * @gqlType */
class User {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(salutation: string): string {
    return `${salutation}, ${this.name}`;
  }
}
