/** @GQLType */
export default class Query {
  /** @GQLField */
  someField1({ hello = null }: { hello: String | null }): string {
    if (hello === null) return "hello";
    return "hello";
  }
  /** @GQLField */
  someField2({ hello = undefined }: { hello: String | undefined }): string {
    if (hello === null) return "hello";
    return "hello";
  }
}
