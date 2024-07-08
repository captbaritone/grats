/** @gqlType */
class Parent {}

/** @gqlField */
export function parentField(_: Parent): string {
  return "parentField";
}

/** @gqlType */
export class Child extends Parent {
  /** @gqlField */
  childField: string;
}
