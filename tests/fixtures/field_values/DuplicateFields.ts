@ObjectType
export default class Query {
  @Field
  hello(): string {
    return "Hello world!";
  }
  @Field
  hello(): Array<string> {
    return "Hello world!";
  }
}
