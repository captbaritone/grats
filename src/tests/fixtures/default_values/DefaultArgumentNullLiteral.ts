/** @gqlType */
export default class Query {
  /** @gqlField */
  someField1({ hello = null }: { hello: string | null }): string {
    if (hello === null) return "hello";
    return "hello";
  }
  /** @gqlField */
  someField2({ hello = undefined }: { hello: string | undefined }): string {
    if (hello === null) return "hello";
    return "hello";
  }
}
