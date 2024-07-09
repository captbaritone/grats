import {
  ConstDirectiveNode,
  DefinitionNode,
  DocumentNode,
  Kind,
  Location,
  parse,
} from "graphql";
import { uniqueId } from "./utils/helpers";

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
    hasTypeNameField: boolean;
    exported?: {
      tsModulePath: string;
      exportName: string | null;
    };
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
      Name of property/method/function. Defaults to field name.
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
