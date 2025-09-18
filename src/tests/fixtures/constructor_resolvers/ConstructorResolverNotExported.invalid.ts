/** @gqlType */
export class User {
  constructor(public id: string, public name: string) {}
}

/** @gqlType */
class UserService {
  /**
   * @gqlQueryField createUser
   */
  constructor(id: string, name: string) {
    return new User(id, name);
  }
}