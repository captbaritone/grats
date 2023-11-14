import { Context, UserData } from "../context";
import IPerson from "../interfaces/IPerson";
import GroupResolver from "./Group";

/** @gqlType User */
export default class UserResolver implements IPerson {
  __typename = "User";
  _id: string;
  _data: UserData | undefined;

  constructor(id: string, userData?: UserData) {
    this._id = id;
    this._data = userData;
  }

  /** @gqlField */
  id(): string {
    return this._id
  }

  /** @gqlField */
  async name(_: unknown, { userService }: Context): Promise<string> {
    if (this._data === undefined) {
      this._data = await userService.getUser(this._id)
    }
    return this._data?.name;
  }

  /** @gqlField */
  async groups(_: unknown, { userService }: Context): Promise<GroupResolver[]> {
    if (this._data === undefined) {
      this._data = await userService.getUser(this._id)
    }
    return this._data.groupIDs.map(groupId => new GroupResolver(groupId));
  }
}
