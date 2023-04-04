/** @gqlType */
export class Query {
  /** @gqlField */
  hello: MyEnum;
}

type Valid = "VALID";
type Invalid = "INVALID";

/** @gqlEnum */
type MyEnum = Valid | Invalid;
