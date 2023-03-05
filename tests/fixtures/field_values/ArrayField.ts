@ObjectType
export default class Query {
  @Field
  hello(): Array<string> {
    return ["Hello world!"];
  }
}
