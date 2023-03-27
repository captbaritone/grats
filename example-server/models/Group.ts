import User from "./User";

/** @gqlType */
export default class Group {
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
