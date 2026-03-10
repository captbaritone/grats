import * as DB from "../Database.js";
import { VC } from "../ViewerContext.js";
import { Post } from "./Post.js";
import { User } from "./User.js";

/**
 * The currently authenticated viewer.
 * @gqlType */
export class Viewer {
  /**
   * The currently authenticated user.
   * @gqlField */
  async user(vc: VC): Promise<User> {
    return vc.getUserById(vc.userId());
  }

  /**
   * An "algorithmically generated" feed of posts.
   *
   * **Note:** Due to the extreme complexity of this algorithm, it can be slow.
   * It is recommended to use `@stream` to avoid blocking the client.
   * @gqlField
   */
  async *feed(vc: VC): AsyncIterable<Post> {
    const rows = await DB.selectPosts(vc);
    for (const row of rows) {
      // Simulate a slow algorithm
      await new Promise((resolve) => setTimeout(resolve, 500));
      yield row;
    }
  }
  // --- Root Fields ---

  /**
   * The currently authenticated viewer.
   * @gqlQueryField */
  static viewer(): Viewer {
    return new Viewer();
  }
}
