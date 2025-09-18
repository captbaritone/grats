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
export default class UserService {
  /**
   * @gqlQueryField createUser
   */
  constructor(public id: string, public name: string) {}

  /** @gqlField */
  getUser(): User {
    return new User(this.id, this.name);
  }
}