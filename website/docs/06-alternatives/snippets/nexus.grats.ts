import { Int } from "grats";

/** @gqlType */
type Post = {
  /** @gqlField */
  id: Int; // <- Field named `id` of type `Int`
  /** @gqlField */
  title: string; // <- Field named `title` of type `String`
  /** @gqlField */
  body: string; // <- Field named `body` of type `String`
  /** @gqlField */
  published: boolean; // <- Field named `published` of type `Boolean`
};
