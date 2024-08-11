import * as DB from "../Database";
import { Ctx } from "../ViewerContext";
import { Query } from "../graphql/Roots";
import { Post } from "./Post";
import { User } from "./User";

/**
 * The currently authenticated viewer.
 * @gqlType */
export class Viewer {
  /**
   * The currently authenticated user.
   * @gqlField */
  async user(ctx: Ctx): Promise<User> {
    return ctx.vc.getUserById(ctx.vc.userId());
  }

  /**
   * An "algorithmically generated" feed of posts.
   *
   * **Note:** Due to the extreme complexity of this algorithm, it can be slow.
   * It is recommended to use `@stream` to avoid blocking the client.
   * @gqlField
   */
  async *feed(ctx: Ctx): AsyncIterable<Post> {
    const rows = await DB.selectPosts(ctx.vc);
    for (const row of rows) {
      // Simulate a slow algorithm
      await new Promise((resolve) => setTimeout(resolve, 500));
      yield new Post(ctx.vc, row);
    }
  }
  // --- Root Fields ---

  /**
   * The currently authenticated viewer.
   * @gqlField */
  static viewer(_: Query): Viewer {
    return new Viewer();
  }
}
