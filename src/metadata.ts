/**
 * Grats extracts a GraphQL schema from your TypeScript source code, but it also
 * infers additional non-Schema information, such as the signature of your
 * resolves.
 *
 * In order to allow external tools to make use of Grats' analysis, we are
 * are EXPERIMENTING with exposing the result of Grats' analysis as JSON. This
 * file contains the TypeScript types describing that shape.
 *
 * In the future we may formalize this more with things like JSON schema, but
 * for now we are just using TypeScript types.
 */

// Note: An example of replacing codegen with a dynamic default resolve powered
// by this JSON schema:
// https://gist.github.com/captbaritone/f66d0355645a32494da368d0448b9d7a

/** Metadata for the full schema */
export type Metadata = {
  /** Types in the schema */
  types: Record<string, Record<string, FieldDefinition>>;
};

/** A GraphQL object type definition */
export type ObjectTypeDefinition = {
  kind: "object";
  fields: Record<string, FieldDefinition>;
};

/** A GraphQL field */
export type FieldDefinition = {
  resolver: ResolverDefinition;
};

/**
 * Information about the resolver for this field. Should be sufficient to either
 * dynamically invoke the resolver at runtime (inefficiently) or codegen JavaScript
 * to define the resolver function.
 */
export type ResolverDefinition =
  | PropertyResolver
  | FunctionResolver
  | MethodResolver
  | StaticMethodResolver;

/**
 * A field which is simply backed by a property (or getter) on the source object
 */
export type PropertyResolver = {
  kind: "property";
  name: string | null; // If omitted the field name is the same as the property name
};

/**
 * A field which is backed by a function exported from a module. This is the
 * most flexible kind of resolver.
 */
export type FunctionResolver = {
  kind: "function";
  path: string; // Path to the module
  exportName: string | null; // Name of the export. If omitted the function is the default export.
  arguments: ResolverArgument[] | null;
};

/**
 * A field which is backed by a method on the source object
 */
export type MethodResolver = {
  kind: "method";
  name: string | null; // Method name. If omitted, the method name is the same as the field name
  arguments: ResolverArgument[] | null;
};

/**
 * A field which is backed by a static method on a class exported from a module
 */
export type StaticMethodResolver = {
  kind: "staticMethod";
  path: string; // Path to the module
  exportName: string | null; // Export name. If omitted, the class is the default export
  name: string; // Method name
  arguments: ResolverArgument[] | null;
};

export type ContextArgs = ContextArgument | DerivedContextArgument;

/** An argument expected by a resolver function or method */
export type ResolverArgument =
  | SourceArgument
  | ArgumentsObjectArgument
  | ContextArgument
  | DerivedContextArgument
  | InformationArgument
  | NamedArgument;

/** The source or parent object */
export type SourceArgument = {
  kind: "source";
};

/** An arguments object containing all the field arguments */
export type ArgumentsObjectArgument = {
  kind: "argumentsObject";
};

/** The GraphQL context */
export type ContextArgument = {
  kind: "context";
};

/** A context value which is expressed as a function of the global context */
export type DerivedContextArgument = {
  kind: "derivedContext";
  path: string; // Path to the module
  exportName: string | null; // Export name. If omitted, the class is the default export
  args: Array<ContextArgs>;
  async: boolean;
};

/** The GraphQL info object */
export type InformationArgument = {
  kind: "information";
};

/** A single named GraphQL argument */
export type NamedArgument = {
  kind: "named";
  name: string; // Name of the GraphQL field argument
};
