/** @gqlInterface */
interface MyInterface {
  /** @gqlField */
  interfaceField: string;
}

/** @gqlType */
export class MyType implements MyInterface {
  __typename: "MyType" = "MyType";
  interfaceField: string;
  /** @gqlField */
  typeField: string;
}
