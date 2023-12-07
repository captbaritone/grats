import { DocumentNode, parse } from "graphql";

// TODO: Rename to be generic since it can apply to properties as well as methods.
export const METHOD_NAME_DIRECTIVE = "methodName";
export const METHOD_NAME_ARG = "name";
export const EXPORTED_DIRECTIVE = "exported";
export const JS_MODULE_PATH_ARG = "jsModulePath";
export const TS_MODULE_PATH_ARG = "tsModulePath";
export const ARG_COUNT = "argCount";
export const EXPORTED_FUNCTION_NAME_ARG = "functionName";
export const ASYNC_ITERABLE_TYPE_DIRECTIVE = "asyncIterable";

export const DIRECTIVES_AST: DocumentNode = parse(`
    directive @${ASYNC_ITERABLE_TYPE_DIRECTIVE} on FIELD_DEFINITION
    directive @${METHOD_NAME_DIRECTIVE}(${METHOD_NAME_ARG}: String!) on FIELD_DEFINITION
    directive @${EXPORTED_DIRECTIVE}(
      ${JS_MODULE_PATH_ARG}: String!,
      ${TS_MODULE_PATH_ARG}: String!,
      ${EXPORTED_FUNCTION_NAME_ARG}: String!
      ${ARG_COUNT}: Int!
    ) on FIELD_DEFINITION
`);
