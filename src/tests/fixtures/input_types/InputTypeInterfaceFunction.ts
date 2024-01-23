/** @gqlInput */
interface MyInputType {
  // TypeScript lets you define functions using interfaces,
  // but that makes no sense as a GraphQL input type.
  (arg: string): string;
}
