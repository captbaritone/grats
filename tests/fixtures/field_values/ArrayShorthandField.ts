@ObjectType
export default class Query {
  @Field
  hello(): string[] {
    return ["Hello world!"];
  }
}
