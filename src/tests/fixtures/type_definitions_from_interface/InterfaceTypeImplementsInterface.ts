/** @GQLType */
export default interface Query extends HasName {
  /** @GQLField */
  hello: string;

  /** @GQLField */
  name: string;
}

/** @GQLInterface */
interface HasName {
  /** @GQLField */
  name: string;
}
