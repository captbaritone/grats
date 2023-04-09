/** @gqlType */
type User = {
  _bestFriendID: number;
};

/** @gqlField */
export function friends(user: User, args: { order: string }, context): User {
  return context.db.getSortedFriends(user._bestFriendID, args.order);
}
