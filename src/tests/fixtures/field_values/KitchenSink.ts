/** @GQLType */
export default class Query {
  /** @GQLField */
  hello(args: { greeting: string }): string {
    return `${args.greeting ?? "Hello"} world!`;
  }

  /** @GQLField */
  greetings(args: { greeting: string }): string[] {
    return [`${args.greeting ?? "Hello"} world!`];
  }
  /** @GQLField */
  greetings1(args: { greeting: string }): Array<string> {
    return [`${args.greeting ?? "Hello"} world!`];
  }
  /** @GQLField */
  greetings2(args: { greeting: string }): ReadonlyArray<string> {
    return [`${args.greeting ?? "Hello"} world!`];
  }

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
  groups(): Group[] {
    return [new Group()];
  }
}

/** @GQLType */
class Group {
  /** @GQLField */
  description: string;

  constructor() {
    this.description = "A group of people";
  }

  /** @GQLField */
  name(): string {
    return "Pal's Club";
  }
  /** @GQLField */
  async members(): Promise<User[]> {
    return [new User()];
  }
}
