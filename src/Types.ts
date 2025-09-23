import type {
  GraphQLResolveInfo,
  GraphQLScalarLiteralParser,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
} from "graphql";

/** @gqlScalar */
export type Float = number;
/** @gqlScalar */
export type Int = number;
/** @gqlScalar */
export type ID = string;

/** @gqlInfo */
export type GqlInfo = GraphQLResolveInfo;

export type GqlScalar<TExternal, TInternal> = {
  /** Serializes an internal value to include in a response. */
  serialize?: GraphQLScalarSerializer<TExternal>;
  /** Parses an externally provided value to use as an input. */
  parseValue?: GraphQLScalarValueParser<TInternal>;
  /** Parses an externally provided literal value to use as an input. */
  parseLiteral?: GraphQLScalarLiteralParser<TInternal>;
};
