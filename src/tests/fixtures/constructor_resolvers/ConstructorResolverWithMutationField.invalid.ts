/** @gqlType */
export class User {
  constructor(public id: string, public name: string) {}
}

/** @gqlType */
export class UserService {
  /**
   * @gqlMutationField createUser
   */
  constructor(id: string, name: string) {
    return new User(id, name);
  }
}