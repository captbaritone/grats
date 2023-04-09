/** @gqlType */
class User {
  _bestFriendID: number;
  /** @gqlField */
  bestFriend(args: { order: string }, context): User {
    return context.db.getSortedFriends(this._bestFriendID, args.order);
  }
}
