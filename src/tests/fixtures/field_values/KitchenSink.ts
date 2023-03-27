/** @gqlType */
export default class Query {
  /** @gqlField */
  hello(args: { greeting: string }): string {
    return `${args.greeting ?? "Hello"} world!`;
  }

  /** @gqlField */
  greetings(args: { greeting: string }): string[] {
    return [`${args.greeting ?? "Hello"} world!`];
  }
  /** @gqlField */
  greetings1(args: { greeting: string }): Array<string> {
    return [`${args.greeting ?? "Hello"} world!`];
  }
  /** @gqlField */
  greetings2(args: { greeting: string }): ReadonlyArray<string> {
    return [`${args.greeting ?? "Hello"} world!`];
  }

  /** @gqlField */
  me(): User {
    return new User();
  }
}

/** @gqlType */
class User {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
  /** @gqlField */
  groups(): Group[] {
    return [new Group()];
  }
}

/** @gqlType */
class Group {
  /** @gqlField */
  description: string;

  constructor() {
    this.description = "A group of people";
  }

  /** @gqlField */
  name(): string {
    return "Pal's Club";
  }
  /** @gqlField */
  async members(): Promise<User[]> {
    return [new User()];
  }
}
