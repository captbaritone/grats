// trim-start
/** @gqlContext */
type Ctx = {
  vc: string;
};

/** @gqlType */
class Post {
  /** @gqlField */
  id: string;
  constructor(row: { id: string }) {
    this.id = row.id;
  }
}

const DB = {
  async selectPosts(_vc: string): Promise<{ id: string }[]> {
    return [];
  },
};

// trim-end
/** @gqlType */
class Viewer {
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
      yield new Post(row);
    }
  }
}
