/** @gqlType */
export class User {
  constructor(public id: string, public name: string, public email?: string) {}

  /** @gqlField */
  getId(): string {
    return this.id;
  }

  /** @gqlField */
  getName(): string {
    return this.name;
  }

  /** @gqlField */
  getEmail(): string | null {
    return this.email ?? null;
  }
}

/** @gqlType */
export class UserService {
  /**
   * @gqlQueryField createUser
   */
  constructor(public id: string, public name: string, public email?: string | null) {}

  /** @gqlField */
  getUser(): User {
    return new User(this.id, this.name, this.email ?? undefined);
  }
}