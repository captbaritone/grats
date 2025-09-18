/** @gqlType */
export class User {
  constructor(public id: string, public name: string) {}
}

/** @gqlType */
export class UserService {
  /**
   * @gqlQueryField
   */
  constructor(id: string, name: string) {
    return new User(id, name);
  }
}