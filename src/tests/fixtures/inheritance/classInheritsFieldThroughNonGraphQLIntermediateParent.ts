/** @gqlType */
class Parent {
  /** @gqlField */
  parentField: string;
}

class Intermediate extends Parent {}

/** @gqlType */
export class Child extends Intermediate {
  /** @gqlField */
  childField: string;
}
