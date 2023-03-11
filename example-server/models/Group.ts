import User from "./User";

/** @GQLType */
export default class Group {
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
