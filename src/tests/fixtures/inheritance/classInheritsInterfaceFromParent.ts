/** @gqlInterface */
interface MyInterface {
  /** @gqlField */
  parentField: string;
}

/** @gqlType */
class Parent implements MyInterface {
  __typename: string = "Parent" as const;
  parentField: string;
}

/** @gqlType */
export class Child extends Parent {
  __typename: "Child" = "Child";
  /** @gqlField */
  childField: string;
}
