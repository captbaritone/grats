/** @gqlType */
class Parent {
  /** @gqlField */
  parentField: string;
}

/** @gqlType */
class Child extends Parent {
  /** @gqlField */
  childField: string;
}
