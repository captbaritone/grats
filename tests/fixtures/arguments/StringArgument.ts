@ObjectType
export default class Query {
  @Field
  hello({ greeting }: { greeting: string }): string {
    return "Hello world!";
  }
}
