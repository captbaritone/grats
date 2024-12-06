export interface Resolvers {
  types: Record<string, Record<string, ResolverDefinition>>;
}

export type ResolverDefinition =
  | PropertyResolver
  | FunctionResolver
  | MethodResolver
  | StaticMethodResolver;

export type PropertyResolver = {
  kind: "property";
  name: string | null; // Optional, defaults to the field name
};

export type FunctionResolver = {
  kind: "function";
  path: string; // Path to the module
  exportName: string | null; // Name of the export, optional for default exports
  arguments: ResolverArgument[] | null;
};

export type MethodResolver = {
  kind: "method";
  name: string | null; // Method name
  arguments: ResolverArgument[] | null;
};

export type StaticMethodResolver = {
  kind: "staticMethod";
  path: string; // Path to the module
  exportName: string | null; // Export name
  name: string; // Method name
  arguments: ResolverArgument[] | null;
};

export type ResolverArgument =
  | SourceArgument
  | ArgumentsObjectArgument
  | ContextArgument
  | InformationArgument
  | NamedArgument;

export type SourceArgument = {
  kind: "source";
};

export type ArgumentsObjectArgument = {
  kind: "argumentsObject";
};

export type ContextArgument = {
  kind: "context";
};

export type InformationArgument = {
  kind: "information";
};

export type NamedArgument = {
  kind: "named";
  name: string; // Name of the GraphQL field argument
};
