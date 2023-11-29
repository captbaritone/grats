import { Context, GroupData } from "../context";
import UserResolver from "./User";

/** @gqlType Group */
export default class GroupResolver {
  __typename = "Group";
  _id: string;
  _data: GroupData | undefined;

  constructor(id: string, groupData?: GroupData) {
    this._id = id;
    this._data = groupData;
  }

  /** @gqlField */
  id(): string {
    return this._id;
  }

  /** @gqlField */
  async name(_: unknown, { groupService }: Context): Promise<string> {
    if (this._data === undefined) {
      this._data = await groupService.getGroup(this._id);
    }
    return this._data?.name;
  }

  /** @gqlField */
  async members(_: unknown, { userService }: Context): Promise<UserResolver[]> {
    const currentGroupId = this._id;
    return userService
      .listUsers()
      .then((users) =>
        users
          .filter(({ groupIDs }) => groupIDs.includes(currentGroupId))
          .map((user) => new UserResolver(user.id, user)),
      );
  }
}
