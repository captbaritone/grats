/** @gqlType */
class User {
  _bestFriendID: number;
  /** @gqlField */
  bestFriend(order: string, context: GqlContext): User {
    return context.db.getSortedFriends(this._bestFriendID, order);
  }
}

/** @gqlContext */
type GqlContext = {
  db: { getSortedFriends(id: number, order: string): User };
};
