/** @gqlType */
export class SomeType {
  /** @gqlField */
  hello: MyEnum;
}

/** The "valid" case */
type Valid = "VALID";
/** The "invalid" case */
type Invalid = "INVALID";

/** @gqlEnum */
type MyEnum = Valid | Invalid;
