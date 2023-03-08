@ObjectType
class Query {
  @Field
  async me(): Promise<User> {
    return new User();
  }
}

@ObjectType
class User {
  @Field
  name(): string {
    return "Alice";
  }
  @Field
  friends(): User[] {
    return [new User()];
  }
}
