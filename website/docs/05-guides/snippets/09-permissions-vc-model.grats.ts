// trim-start
type VC = {};

/** @gqlType */
class Post {
  constructor(_vc: VC) {}

  /** @gqlField */
  title: string;
}

// trim-end
/** @gqlType */
class User {
  constructor(private vc: VC /* ... other fields */) {}

  /** @gqlField */
  post(): Post {
    return new Post(this.vc);
  }
}
