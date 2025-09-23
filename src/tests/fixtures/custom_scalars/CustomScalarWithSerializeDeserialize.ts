import { GqlScalar } from "../../../Types";

type CustomScalarInputType = string;
type CustomScalarOutputType = number;

/** @gqlScalar Custom */
export const CustomScalar: GqlScalar<
  CustomScalarInputType,
  CustomScalarOutputType
> = {
  serialize(outputValue) {
    // value comes from the server, so it's already in the internal format
    return "10";
  },
  parseValue(value) {
    // value comes from the client, so we need to convert it to the internal format
    return Number(value);
  },
  parseLiteral(ast) {
    if (ast.kind === "StringValue") {
      return Number(ast.value);
    }
    throw new Error(
      "Query error: Can only parse strings to numbers but got a: " + ast.kind,
    );
  },
};
