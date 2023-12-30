import {
  ConstArgumentNode,
  ConstDirectiveNode,
  DocumentNode,
  Kind,
  Location,
  parse,
} from "graphql";
import { GratsDefinitionNode } from "./GraphQLConstructor";

export const FIELD_NAME_DIRECTIVE = "propertyName";
const FIELD_NAME_ARG = "name";

export const EXPORTED_DIRECTIVE = "exported";
const TS_MODULE_PATH_ARG = "tsModulePath";
const ARG_COUNT = "argCount";
const EXPORTED_FUNCTION_NAME_ARG = "functionName";

export const ASYNC_ITERABLE_TYPE_DIRECTIVE = "asyncIterable";

export const KILLS_PARENT_ON_EXCEPTION_DIRECTIVE = "killsParentOnException";

export const METADATA_DIRECTIVE_NAMES = new Set([
  FIELD_NAME_DIRECTIVE,
  EXPORTED_DIRECTIVE,
  ASYNC_ITERABLE_TYPE_DIRECTIVE,
  KILLS_PARENT_ON_EXCEPTION_DIRECTIVE,
]);

export const DIRECTIVES_AST: DocumentNode = parse(`
    directive @${ASYNC_ITERABLE_TYPE_DIRECTIVE} on FIELD_DEFINITION
    directive @${FIELD_NAME_DIRECTIVE}(${FIELD_NAME_ARG}: String!) on FIELD_DEFINITION
    directive @${EXPORTED_DIRECTIVE}(
      ${TS_MODULE_PATH_ARG}: String!,
      ${EXPORTED_FUNCTION_NAME_ARG}: String!
      ${ARG_COUNT}: Int!
    ) on FIELD_DEFINITION | SCALAR
    directive @${KILLS_PARENT_ON_EXCEPTION_DIRECTIVE} on FIELD_DEFINITION
`);

export function addMetadataDirectives(
  definitions: Array<GratsDefinitionNode>,
): Array<GratsDefinitionNode> {
  return [...DIRECTIVES_AST.definitions, ...definitions];
}

export type AsyncIterableTypeMetadata = true;

export type PropertyNameMetadata = {
  name: string;
};

export type ExportedMetadata = {
  tsModulePath: string;
  exportedFunctionName: string;
  argCount: number;
};

export function makePropertyNameDirective(
  loc: Location,
  propertyName: PropertyNameMetadata,
): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    loc,
    name: { kind: Kind.NAME, loc, value: FIELD_NAME_DIRECTIVE },
    arguments: [makeStringArg(loc, FIELD_NAME_ARG, propertyName.name)],
  };
}

export function makeExportedDirective(
  loc: Location,
  exported: ExportedMetadata,
): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    loc,
    name: { kind: Kind.NAME, loc, value: EXPORTED_DIRECTIVE },
    arguments: [
      makeStringArg(loc, TS_MODULE_PATH_ARG, exported.tsModulePath),
      makeStringArg(
        loc,
        EXPORTED_FUNCTION_NAME_ARG,
        exported.exportedFunctionName,
      ),
      makeIntArg(loc, ARG_COUNT, exported.argCount),
    ],
  };
}

export function makeAsyncIterableDirective(loc: Location): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    loc,
    name: { kind: Kind.NAME, loc, value: ASYNC_ITERABLE_TYPE_DIRECTIVE },
    arguments: [],
  };
}

export function makeKillsParentOnExceptionDirective(
  loc: Location,
): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    loc,
    name: { kind: Kind.NAME, loc, value: KILLS_PARENT_ON_EXCEPTION_DIRECTIVE },
    arguments: [],
  };
}

export function parseAsyncIterableTypeDirective(
  directive: ConstDirectiveNode,
): AsyncIterableTypeMetadata {
  if (directive.name.value !== ASYNC_ITERABLE_TYPE_DIRECTIVE) {
    throw new Error(
      `Expected directive to be ${ASYNC_ITERABLE_TYPE_DIRECTIVE}`,
    );
  }
  return true;
}

export function parsePropertyNameDirective(
  directive: ConstDirectiveNode,
): PropertyNameMetadata {
  if (directive.name.value !== FIELD_NAME_DIRECTIVE) {
    throw new Error(`Expected directive to be ${FIELD_NAME_DIRECTIVE}`);
  }

  return { name: getStringArg(directive, FIELD_NAME_ARG) };
}

export function parseExportedDirective(
  directive: ConstDirectiveNode,
): ExportedMetadata {
  if (directive.name.value !== EXPORTED_DIRECTIVE) {
    throw new Error(`Expected directive to be ${EXPORTED_DIRECTIVE}`);
  }
  return {
    tsModulePath: getStringArg(directive, TS_MODULE_PATH_ARG),
    exportedFunctionName: getStringArg(directive, EXPORTED_FUNCTION_NAME_ARG),
    argCount: getIntArg(directive, ARG_COUNT),
  };
}

function getStringArg(directive: ConstDirectiveNode, argName: string): string {
  const arg = directive.arguments?.find((arg) => arg.name.value === argName);
  if (!arg) {
    throw new Error(`Expected to find argument ${argName}`);
  }

  if (arg.value.kind !== Kind.STRING) {
    throw new Error(`Expected argument ${argName} to be a string`);
  }

  return arg.value.value;
}

function getIntArg(directive: ConstDirectiveNode, argName: string): number {
  const arg = directive.arguments?.find((arg) => arg.name.value === argName);
  if (!arg) {
    throw new Error(`Expected to find argument ${argName}`);
  }

  if (arg.value.kind !== Kind.INT) {
    throw new Error(`Expected argument ${argName} to be an int`);
  }

  return parseInt(arg.value.value, 10);
}

function makeStringArg(
  loc: Location,
  argName: string,
  value: string,
): ConstArgumentNode {
  return {
    kind: Kind.ARGUMENT,
    loc,
    name: { kind: Kind.NAME, loc, value: argName },
    value: { kind: Kind.STRING, loc, value },
  };
}

function makeIntArg(
  loc: Location,
  argName: string,
  value: number,
): ConstArgumentNode {
  return {
    kind: Kind.ARGUMENT,
    loc,
    name: { kind: Kind.NAME, loc, value: argName },
    value: { kind: Kind.INT, loc, value: value.toString() },
  };
}
