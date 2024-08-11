import DataLoader from "dataloader";
import { getPostsByIds, getUsersByIds, getLikesByIds } from "./Database";
import { YogaInitialContext } from "graphql-yoga";
import { Post } from "./models/Post";
import { User } from "./models/User";
import { Like } from "./models/Like";

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
  _postLoader: DataLoader<string, Post>;
  _userLoader: DataLoader<string, User>;
  _likeLoader: DataLoader<string, Like>;
  _logs: string[] = [];
  constructor() {
    this._postLoader = new DataLoader((ids) => getPostsByIds(this, ids));
    this._userLoader = new DataLoader((ids) => getUsersByIds(this, ids));
    this._likeLoader = new DataLoader((ids) => getLikesByIds(this, ids));
  }
  async getPostById(id: string): Promise<Post> {
    return this._postLoader.load(id);
  }
  async getUserById(id: string): Promise<User> {
    return this._userLoader.load(id);
  }
  async getLikeById(id: string): Promise<Like> {
    return this._likeLoader.load(id);
  }
  userId(): string {
    // We don't have authentication in this example app, so we'll just assume
    // the user is always user 1.
    return "1";
  }
  log(message: string) {
    this._logs.push(message);
    console.log(message);
  }
}

/** @gqlContext */
export type Ctx = YogaInitialContext & { vc: VC };
