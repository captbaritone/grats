/** @gqlType */
class Parent {
  /**
   * The description from the parent class
   * @gqlField
   * @deprecated
   */
  commonField: string;
}

/** @gqlType */
export class Child extends Parent {
  /** @gqlField */
  childField: string;

  /**
   * The description from the child class
   * @killsParentOnException
   * @gqlField
   */
  commonField: string;
}
