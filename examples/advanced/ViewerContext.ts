import DataLoader from "dataloader";
import { PostRow, UserRow, getPostsByIds, getUsersByIds } from "./Database";
import { YogaInitialContext } from "graphql-yoga";

/**
 * Viewer Context
 *
 * This object represents the entity reading the data during this request. It
 * acts as a per-request memoization cache as well as a representation of what
 * permissions the entity reading the data has.
 *
 * It should be constructed once at the beginning of the request and threaded
 * through the entire request.
 */
export class VC {
  _postLoader: DataLoader<string, PostRow>;
  _userLoader: DataLoader<string, UserRow>;
  _logs: string[] = [];
  constructor() {
    this._postLoader = new DataLoader((ids) => getPostsByIds(this, ids));
    this._userLoader = new DataLoader((ids) => getUsersByIds(this, ids));
  }
  async getPostById(id: string): Promise<PostRow> {
    return this._postLoader.load(id);
  }
  async getUserById(id: string): Promise<UserRow> {
    return this._userLoader.load(id);
  }
  log(message: string) {
    this._logs.push(message);
    console.log(message);
  }
}

export type Ctx = YogaInitialContext & { vc: VC };
