import {
  ConstDirectiveNode,
  DocumentNode,
  Kind,
  Location,
  parse,
} from "graphql";
import { GratsDefinitionNode } from "./GraphQLConstructor";
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
    tsIdentifier: number;
    wasSynthesized?: boolean;
  }
}

export const FIELD_METADATA_DIRECTIVE = "metadata";
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
      Name of property/method/function. Defaults to field name. For
      function-backed fields, this is the function's export name.
      """
      ${FIELD_NAME_ARG}: String
      """
      Path of the TypeScript module to import if the field is a function.
      """
      ${TS_MODULE_PATH_ARG}: String
      """
      Number of arguments. No value means property access
      """
      ${ARG_COUNT}: Int
    ) on FIELD_DEFINITION
    directive @${KILLS_PARENT_ON_EXCEPTION_DIRECTIVE} on FIELD_DEFINITION
`);

export function addMetadataDirectives(
  definitions: Array<GratsDefinitionNode>,
): Array<GratsDefinitionNode> {
  return [...DIRECTIVES_AST.definitions, ...definitions];
}

export type FieldMetadata = {
  tsModulePath: string | null;
  name: string | null;
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
