/** @GQLType */
export default class Query {
  /** @GQLField */
  me(): User {
    return new User();
  }
}

/** @GQLType */
class User {
  /** @GQLField */
  name(): string {
    return "Alice";
  }
  /** @GQLField */
  greeting(args: { salutation: string }): string {
    return `${args.salutation}, ${this.name()}`;
  }
}
