/** @gqlType */
class User {
  _bestFriendID: number;
  /** @gqlField */
  bestFriend(args: { order: string }, context: GqlContext): User {
    return context.db.getSortedFriends(this._bestFriendID, args.order);
  }
}

type GqlContext = {
  db: { getSortedFriends(id: number, order: string): User };
};
