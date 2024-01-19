@ObjectType()
/** @gqlType */
export default class Composer {
  @Field()
  /** @gqlField */
  url(): string {
    return `/composer/`;
  }
}
