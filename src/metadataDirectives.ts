import {
  ConstDirectiveNode,
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  Kind,
  Location,
  parse,
} from "graphql";
import { nullThrows, uniqueId } from "./utils/helpers";

/**
 * In most cases we can use directives to annotate constructs
 * however, it't not possible to annotate an individual TypeNode.
 * Additionally, we can't use sets or maps to "tag" nodes because
 * there are places where we immutably update the AST to make changes.
 *
 * Instead, we cheat and add properties to some nodes. These types use
 * interface merging to add our own properties to the AST.
 *
 * We try to use this approach sparingly.
 */
declare module "graphql" {
  export interface ListTypeNode {
    /**
     * Grats metadata: Whether the list type was defined as an AsyncIterable.
     * Used to ensure that all fields on `Subscription` return an AsyncIterable.
     */
    isAsyncIterable?: boolean;
  }
  export interface NameNode {
    /**
     * Grats metadata: A unique identifier for the node. Used to track
     * data about nodes in lookup data structures.
     */
    tsIdentifier: number;
  }
  export interface ObjectTypeDefinitionNode {
    /**
     * Grats metadata: Indicates that the type was materialized as part of
     * generic type resolution.
     */
    wasSynthesized?: boolean;
  }
  export interface UnionTypeDefinitionNode {
    /**
     * Grats metadata: Indicates that the type was materialized as part of
     * generic type resolution.
     */
    wasSynthesized?: boolean;
  }
  export interface InterfaceTypeDefinitionNode {
    /**
     * Grats metadata: Indicates that the type was materialized as part of
     * generic type resolution.
     */
    wasSynthesized?: boolean;
  }
  export interface ObjectTypeExtensionNode {
    /**
     * Grats metadata: Indicates that we don't know yet if this is extending an interface
     * or a type.
     */
    mayBeInterface?: boolean;
  }

  export interface InputValueDefinitionNode {
    /**
     * Grats metadata: If this was a positional argument, this is the index of the argument.
     */
    argIndex?: number;
  }

  export interface FieldDefinitionNode {
    /**
     * Grats metadata: If this field is a function, this is the metadata for the field.
     */
    contextArgIndex?: number;
  }
}

export type ResolverArg =
  | {
      kind: "context";
    }
  | {
      kind: "info";
    }
  | {
      kind: "source";
    }
  | {
      kind: "argsObj";
    }
  | {
      kind: "positionalArg";
      name: string;
    };

export type ResolverSignature =
  | {
      kind: "property";
      name: string | null;
      args: ResolverArg[] | null;
    }
  | {
      kind: "function";
      exportName: string | null;
      tsModulePath: string;
      methodName: string | null;
      args: ResolverArg[];
    };

// As we transition to using resolver signature directly, we can derive it from
// metadata directives etc...
export function resolverSignatureFromField(
  field: FieldDefinitionNode,
): ResolverSignature {
  const metadataDirective = field.directives?.find(
    (directive) => directive.name.value === FIELD_METADATA_DIRECTIVE,
  );

  if (!metadataDirective) {
    return { kind: "property", name: null, args: null };
  }

  const metadata = parseFieldMetadataDirective(metadataDirective);
  const args = argsFromField(field, metadata);

  const { tsModulePath, exportName, name } = metadata;

  if (args == null) {
    return { kind: "property", name, args: null };
  }

  if (tsModulePath != null) {
    return {
      kind: "function",
      tsModulePath,
      exportName,
      methodName: name,
      args,
    };
  }

  return { kind: "property", name, args };
}

export function argsFromField(
  field: FieldDefinitionNode,
  metadata: FieldMetadata,
): ResolverArg[] | null {
  let offset = 0;
  const args: ResolverArg[] = [];
  if (metadata.tsModulePath != null) {
    offset = 1;
    args.push({ kind: "source" });
  }

  const havePositionalArgs =
    field.arguments != null &&
    field.arguments.some((arg) => arg.argIndex != null);

  // We may have zero field arguments but still need context. This could manifest as
  // argCount === 2 OR as a contextArgIndex
  if (
    (field.arguments == null || field.arguments.length === 0) &&
    field.contextArgIndex != null
  ) {
    args.push({ kind: "context" });
    return args;
  }

  if (!havePositionalArgs) {
    const argCount = metadata.argCount;
    if (argCount == null) {
      return null;
    }
    const realCount = argCount - offset;
    if (realCount === 0) {
      // Nothing to do
    } else if (realCount === 1) {
      args.push({ kind: "argsObj" });
    } else if (realCount === 2) {
      args.push({ kind: "argsObj" }, { kind: "context" });
    } else if (realCount === 3) {
      args.push({ kind: "argsObj" }, { kind: "context" }, { kind: "info" });
    } else {
      throw new Error(`Unsupported arg count ${argCount}`);
    }
    return args;
  }

  const fieldArgs = nullThrows(field.arguments);
  for (const arg of fieldArgs) {
    if (arg.argIndex == null) {
      throw new Error("Expected arg to have argIndex");
    }
    args[arg.argIndex + offset] = {
      kind: "positionalArg",
      name: arg.name.value,
    };
  }

  if (field.contextArgIndex != null) {
    args[field.contextArgIndex + offset] = { kind: "context" };
  }

  return args.map((arg) => nullThrows(arg));
}

export const FIELD_METADATA_DIRECTIVE = "metadata";
export const EXPORT_NAME_ARG = "exportName";
export const FIELD_NAME_ARG = "name";
export const TS_MODULE_PATH_ARG = "tsModulePath";
export const ARG_COUNT = "argCount";
export const ASYNC_ITERABLE_ARG = "asyncIterable";

export const KILLS_PARENT_ON_EXCEPTION_DIRECTIVE = "killsParentOnException";

export const METADATA_DIRECTIVE_NAMES = new Set([
  FIELD_METADATA_DIRECTIVE,
  KILLS_PARENT_ON_EXCEPTION_DIRECTIVE,
]);

export const DIRECTIVES_AST: DocumentNode = parse(`
    directive @${FIELD_METADATA_DIRECTIVE}(
      """
      Name of property/method. Defaults to field name.
      """
      ${FIELD_NAME_ARG}: String
      """
      Path of the TypeScript module to import if the field is a function.
      """
      ${TS_MODULE_PATH_ARG}: String
      """
      Export name of the field. For function fields this is the exported function name,
      for static method fields, this is the exported class name.
      """
      ${EXPORT_NAME_ARG}: String
      """
      Number of arguments. No value means property access
      """
      ${ARG_COUNT}: Int
    ) on FIELD_DEFINITION
    directive @${KILLS_PARENT_ON_EXCEPTION_DIRECTIVE} on FIELD_DEFINITION
`);

export function addMetadataDirectives(
  definitions: Array<DefinitionNode>,
): Array<DefinitionNode> {
  return [...DIRECTIVES_AST.definitions, ...definitions];
}

export type FieldMetadata = {
  tsModulePath: string | null;
  name: string | null;
  exportName: string | null;
  argCount: number | null;
};

export function makeKillsParentOnExceptionDirective(
  loc: Location,
): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    loc,
    name: {
      kind: Kind.NAME,
      loc,
      value: KILLS_PARENT_ON_EXCEPTION_DIRECTIVE,
      tsIdentifier: uniqueId(),
    },
    arguments: [],
  };
}

export function parseFieldMetadataDirective(
  directive: ConstDirectiveNode,
): FieldMetadata {
  if (directive.name.value !== FIELD_METADATA_DIRECTIVE) {
    throw new Error(`Expected directive to be ${FIELD_METADATA_DIRECTIVE}`);
  }

  return {
    name: getStringArg(directive, FIELD_NAME_ARG),
    tsModulePath: getStringArg(directive, TS_MODULE_PATH_ARG),
    exportName: getStringArg(directive, EXPORT_NAME_ARG),
    argCount: getIntArg(directive, ARG_COUNT),
  };
}

function getStringArg(
  directive: ConstDirectiveNode,
  argName: string,
): string | null {
  const arg = directive.arguments?.find((arg) => arg.name.value === argName);
  if (!arg) {
    return null;
  }

  if (arg.value.kind !== Kind.STRING) {
    throw new Error(`Expected argument ${argName} to be a string`);
  }

  return arg.value.value;
}

function getIntArg(
  directive: ConstDirectiveNode,
  argName: string,
): number | null {
  const arg = directive.arguments?.find((arg) => arg.name.value === argName);
  if (!arg) {
    return null;
  }

  if (arg.value.kind !== Kind.INT) {
    throw new Error(`Expected argument ${argName} to be an int`);
  }

  return parseInt(arg.value.value, 10);
}
