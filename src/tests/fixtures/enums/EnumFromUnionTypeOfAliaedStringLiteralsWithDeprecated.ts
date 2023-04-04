/** @gqlType */
export class Query {
  /** @gqlField */
  hello: MyEnum;
}

/** @deprecated Don't use this */
type Valid = "VALID";
/** @deprecated Don't use this either */
type Invalid = "INVALID";

/** @gqlEnum */
type MyEnum = Valid | Invalid;
