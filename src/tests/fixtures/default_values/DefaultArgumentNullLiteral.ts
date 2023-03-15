/** @GQLType */
export default class Query {
  /** @GQLField */
  someField1({ hello = null }: { hello: string | null }): string {
    if (hello === null) return "hello";
    return "hello";
  }
  /** @GQLField */
  someField2({ hello = undefined }: { hello: string | undefined }): string {
    if (hello === null) return "hello";
    return "hello";
  }
}
