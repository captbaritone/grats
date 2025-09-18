/** @gqlType */
export class User {
  constructor(public id: string, public name: string) {}

  /** @gqlField */
  getId(): string {
    return this.id;
  }

  /** @gqlField */
  getName(): string {
    return this.name;
  }
}

/** @gqlType */
export class UserService {
  /**
   * Creates a new user with the given ID and name
   * @gqlQueryField createUser
   */
  constructor(public id: string, public name: string) {}

  /** @gqlField */
  getUser(): User {
    return new User(this.id, this.name);
  }
}