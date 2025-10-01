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

/**
 * A GraphQL Scalar type definition with custom serialization and parsing
 * functions.
 *
 * * `TExternal` is the type as seen by the client (e.g. in query results). This
 *   should be JSON serializable.
 * * `TInternal` is the type as seen by resolvers (e.g. in arguments and input
 *   types).
 */
export type GqlScalar<TInternal> = {
  /**
   * Converts `TInternal` returned by a resolver to `TExternal`.
   *
   * _TypeScript/Grats confirm that all resolvers return `TInternal` type.
   *
   * However, the GraphQL spec says all values should be typechecked at runtime,
   * so if you think there your TypeScript typing is not fully sound, you can
   * opt to provide this function to perform runtime validation/conversion.
   */
  serialize?: GraphQLScalarSerializer<unknown>;

  /**
   * Parse/validate the value provided by the client into the type expected by
   * your resolvers as arguments or input type fields.
   *
   * The value provided should be treated as untrusted.
   */
  parseValue?: GraphQLScalarValueParser<TInternal>;

  /**
   * Parses/validate a literal value in the query into the type expected by your
   * resolvers as arguments or input type fields.
   *
   * Note: The AST representation does not include variables, so this function
   * will only be called for literal values in the query.
   */
  parseLiteral?: GraphQLScalarLiteralParser<TInternal>;
};
