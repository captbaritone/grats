@ObjectType
export default class Query {
  @Field
  hello(): ReadonlyArray<string> {
    return ["Hello world!"];
  }
}
