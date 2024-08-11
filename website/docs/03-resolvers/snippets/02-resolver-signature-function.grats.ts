/** @gqlType */
type User = {
  _bestFriendID: number;
};

/** @gqlField */
export function friends(
  user: User,
  args: { order: string },
  context: GqlContext,
): User {
  return context.db.getSortedFriends(user._bestFriendID, args.order);
}

/** @gqlContext */
type GqlContext = {
  db: { getSortedFriends(id: number, order: string): User };
};
