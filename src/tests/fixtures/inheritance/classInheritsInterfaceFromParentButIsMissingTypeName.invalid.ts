/** @gqlInterface */
interface MyInterface {
  /** @gqlField */
  parentField: string;
}

/** @gqlType */
class Parent implements MyInterface {
  __typename: "Parent" = "Parent";
  parentField: string;
}

/** @gqlType */
export class Child extends Parent {
  /** @gqlField */
  childField: string;
}
