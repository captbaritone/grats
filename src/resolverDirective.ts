import * as ts from "typescript";
import { graphql, nullThrows } from "./utils/helpers";
import {
  ConstDirectiveNode,
  ConstValueNode,
  InputValueDefinitionNode,
  Kind,
  Location,
  NameNode,
  StringValueNode,
  TypeNode,
} from "graphql";
import { DiagnosticResult } from "./utils/DiagnosticError";

/**
 * Describes the backing resolver for a field. This broadly matches the
 * `@resolver` directive but has some additional information used internally by
 * Grats such as a variant for unresolved arguments, which get resolved as part
 * of the compilation process, and TypeScript AST nodes for tracking the original sources.
 */
export type Resolver =
  | {
      kind: "property";
      name: string | null;
      node: ts.Node;
    }
  | {
      kind: "method";
      name: string | null;
      arguments: ResolverArgument[] | null;
      node: ts.Node;
    }
  | {
      kind: "function";
      path: string;
      exportName: string | null;
      arguments: ResolverArgument[] | null;
      node: ts.Node;
    }
  | {
      kind: "staticMethod";
      path: string;
      exportName: string | null;
      name: string;
      arguments: ResolverArgument[] | null;
      node: ts.Node;
    };

export type SourceResolverArgument = {
  kind: "source";
  node: ts.Node;
};

export type ArgumentsObjectResolverArgument = {
  kind: "argumentsObject";
  node: ts.Node;
};

export type ContextResolverArgument = {
  kind: "context";
  node: ts.Node;
};

export type InformationResolverArgument = {
  kind: "information";
  node: ts.Node;
};

export type NamedResolverArgument = {
  kind: "named";
  name: string;
  node: ts.Node;
  inputDefinition: InputValueDefinitionNode;
};

export type UnresolvedResolverArgument = {
  kind: "unresolved";
  inputDefinition: InputValueDefinitionNodeOrResolverArg;
  node: ts.Node;
};

export type ResolverArgument =
  | SourceResolverArgument
  | ArgumentsObjectResolverArgument
  | ContextResolverArgument
  | InformationResolverArgument
  | NamedResolverArgument
  | UnresolvedResolverArgument;

/**
 * At extraction time we don't know if a resolver arg is context, info, or a
 * positional GraphQL argument. If it's a positional argument, we need to ensure
 * it has a valid name. If it's just info or context, it's fine if it doesn't
 * have a name e.g. (destructured).
 */
export interface InputValueDefinitionNodeOrResolverArg {
  readonly kind: Kind.INPUT_VALUE_DEFINITION;
  readonly loc: Location;
  readonly description?: StringValueNode;
  // This is the only property that is different.
  readonly name: DiagnosticResult<NameNode>;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

export const RESOLVER_DIRECTIVE_SDL = graphql`
  """
  Describes the backing resolver for a field.
  """
  directive @resolver(kind: ResolverKind!) on FIELD_DEFINITION

  """
  Describes a resolver's implementation in one of several flavors.
  """
  input ResolverKind @oneOf {
    """
    The resolver is a simple property on the source object.
    """
    property: PropertyResolver
    """
    The resolver is a method on the source object.
    """
    method: MethodResolver
    """
    The resolver is function exported from a module.
    """
    function: FunctionResolver
    """
    The resolver is static method on a class exported from a module.
    """
    staticMethod: StaticMethodResolver
  }

  """
  Describes a resolver that is defined as a property or getter on the source object.
  """
  input PropertyResolver {
    """
    The name of the property on the parent object. If omitted the field name is used.
    """
    name: String
  }

  """
  Describes a resolver that is defined as a method on the source object.
  """
  input MethodResolver {
    """
    The name of the method on the source object. If omitted the field name is used.
    """
    name: String
    """
    An ordered list of positional arguments expected by the resolver method.
    """
    arguments: [ResolverArgument]
  }

  """
  Describes a resolver that is defined as a function.
  """
  input FunctionResolver {
    """
    The path of the module from which the function is exported.
    TODO: What should this be relative to?
    TODO: How do we support non-path imports, like imports from libraries?
    """
    path: String!

    """
    The name under which the function is exported. If this property is omitted, a default export is assumed.
    """
    exportName: String

    """
    An ordered list of positional arguments expected by the resolver method.
    """
    arguments: [ResolverArgument]
  }

  """
  Describes a resolver that is defined as a static method on a class.
  """
  input StaticMethodResolver {
    """
    The path of the module from which the class is exported.
    TODO: What should this be relative to?
    TODO: How do we support non-path imports, like imports from libraries?
    """
    path: String!

    """
    The name under which the class is exported. If this property is omitted, a default export is assumed.
    """
    exportName: String

    """
    The name of the static method on the exported class which defines the resolver.
    """
    name: String!

    """
    An ordered list of positional arguments expected by the resolver method.
    """
    arguments: [ResolverArgument]
  }

  """
  Describes a positional JavaScript argument expected by a resolver function or method.
  """
  input ResolverArgument @oneOf {
    """
    The source object. This is what graphql-js resolvers expect in the first position.
    """
    source: Boolean

    """
    An object map containing all the GraphQL arguments.
    This is what graphql-js resolvers expect in the second position.
    """
    argumentsObject: Boolean

    """
    The GraphQL execution context. This is what graphql-js resolvers expect in the third position.
    """
    context: Boolean

    """
    The GraphQL "info" object. This is what graphql-js resolvers expect in the fourth position.
    """
    information: Boolean

    """
    The single GraphQL argument with the given name. This allows resolvers to access individual arguments as positional arguments instead of always needing to access them as a single object map.
    """
    named: String
  }
`;

export const RESOLVER_INPUT_NAMES = [
  "ResolverKind",
  "PropertyResolver",
  "MethodResolver",
  "FunctionResolver",
  "StaticMethodResolver",
  "ResolverArgument",
];
export function parseResolverDirective(
  directive: ConstDirectiveNode,
): Resolver {
  const kind = nullThrows(getObjArg(directive, "kind"));
  if (kind.property != null) {
    const prop = nullThrows(getObjProperty(kind, "property"));
    return {
      kind: "property",
      name: prop.name == null ? null : getString(prop.name),
      node: null as any, // TODO FIXME
    };
  }
  if (kind.function != null) {
    const func = nullThrows(getObjProperty(kind, "function"));
    return {
      kind: "function",
      exportName: func.exportName == null ? null : getString(func.exportName),
      path: nullThrows(getString(func.path)),
      arguments: parseArguments(func.arguments),
      node: null as any, // TODO FIXME
    };
  }
  if (kind.staticMethod != null) {
    const staticMethod = nullThrows(getObjProperty(kind, "staticMethod"));
    return {
      kind: "staticMethod",
      exportName:
        staticMethod.exportName == null
          ? null
          : getString(staticMethod.exportName),
      path: nullThrows(getString(staticMethod.path)),
      name: nullThrows(getString(staticMethod.name)),
      arguments: parseArguments(staticMethod.arguments),
      node: null as any, // TODO FIXME
    };
  }
  if (kind.method != null) {
    const method = nullThrows(getObjProperty(kind, "method"));
    return {
      kind: "method",
      name: method.name == null ? null : getString(method.name),
      arguments: parseArguments(method.arguments),
      node: null as any, // TODO FIXME
    };
  }

  throw new Error("Not implemented");
}

function parseArguments(
  argsArray: ConstValueNode | null,
): ResolverArgument[] | null {
  if (argsArray == null) {
    return null;
  }
  return getArray(argsArray).map((arg) => {
    const argObj = nullThrows(getObj(arg));
    if (argObj.source != null) {
      return {
        kind: "source",
        node: null as any, // TODO FIXME
      };
    }
    if (argObj.argumentsObject != null) {
      return {
        kind: "argumentsObject",
        node: null as any, // TODO FIXME
      };
    }
    if (argObj.context != null) {
      return {
        kind: "context",
        node: null as any, // TODO FIXME
      };
    }
    if (argObj.information != null) {
      return {
        kind: "information",
        node: null as any, // TODO FIXME
      };
    }
    throw new Error("Not implemented");
  });
}

function getArray(value: ConstValueNode): ReadonlyArray<ConstValueNode> {
  if (value.kind !== Kind.LIST) {
    throw new Error(`Expected a list`);
  }

  return value.values;
}

function getString(value: ConstValueNode): string | null {
  if (value.kind !== Kind.STRING) {
    throw new Error(`Expected a string`);
  }

  return value.value;
}

function getObjArg(
  directive: ConstDirectiveNode,
  argName: string,
): { [key: string]: ConstValueNode } | null {
  const arg = directive.arguments?.find((arg) => arg.name.value === argName);
  if (!arg) {
    return null;
  }

  if (arg.value.kind !== Kind.OBJECT) {
    throw new Error(`Expected argument ${argName} to be an object`);
  }

  const obj = {};
  for (const field of arg.value.fields) {
    obj[field.name.value] = field.value;
  }

  return obj;
}

function getObj(
  value: ConstValueNode,
): { [key: string]: ConstValueNode } | null {
  if (value.kind !== Kind.OBJECT) {
    throw new Error(`Expected an object`);
  }

  const obj = {};
  for (const field of value.fields) {
    obj[field.name.value] = field.value;
  }

  return obj;
}

function getObjProperty(
  obj: { [key: string]: ConstValueNode },
  propName: string,
): { [key: string]: ConstValueNode } | null {
  const prop = obj[propName];
  if (!prop) {
    return null;
  }

  if (prop.kind !== Kind.OBJECT) {
    throw new Error(`Expected property ${propName} to be an object`);
  }

  const propObj = {};
  for (const field of prop.fields) {
    propObj[field.name.value] = field.value;
  }

  return propObj;
}
