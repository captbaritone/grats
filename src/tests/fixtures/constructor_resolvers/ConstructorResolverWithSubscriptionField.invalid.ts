/** @gqlType */
export class User {
  constructor(public id: string, public name: string) {}
}

/** @gqlType */
export class UserService {
  /**
   * @gqlSubscriptionField userUpdates
   */
  constructor(id: string) {
    return new User(id, "name");
  }
}