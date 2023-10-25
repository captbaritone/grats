import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import {
  defaultFieldResolver,
  DocumentNode,
  GraphQLFieldConfig,
  GraphQLSchema,
  OperationTypeNode,
  parse,
} from "graphql";
import { resolveRelativePath } from "./gratsRoot";

// TODO: Rename to be generic since it can apply to properties as well as methods.
export const METHOD_NAME_DIRECTIVE = "methodName";
export const METHOD_NAME_ARG = "name";

export const EXPORTED_DIRECTIVE = "exported";
export const EXPORTED_FILENAME_ARG = "filename";
export const EXPORTED_FUNCTION_NAME_ARG = "functionName";

export const EXPORTED_OPERATION_DIRECTIVE = "exportedOperation";
export const EXPORTED_OPERATION_FILENAME_ARG = "filename";
export const EXPORTED_OPERATION_FUNCTION_NAME_ARG = "functionName";
export const EXPORTED_OPERATION_OPERATION_ARG = "operation";

export const DIRECTIVES_AST: DocumentNode = parse(`
    directive @${METHOD_NAME_DIRECTIVE}(${METHOD_NAME_ARG}: String!) on FIELD_DEFINITION
    directive @${EXPORTED_DIRECTIVE}(
      ${EXPORTED_FILENAME_ARG}: String!,
      ${EXPORTED_FUNCTION_NAME_ARG}: String!
    ) on FIELD_DEFINITION
    directive @${EXPORTED_OPERATION_DIRECTIVE}(
      ${EXPORTED_OPERATION_FILENAME_ARG}: String!,
      ${EXPORTED_OPERATION_FUNCTION_NAME_ARG}: String!,
      ${EXPORTED_OPERATION_OPERATION_ARG}: String!
    ) repeatable on SCHEMA
`);

export function applyServerDirectives(schema: GraphQLSchema): GraphQLSchema {
  const operationMap = getOperationMap(schema);

  // TODO: Do we really need all of mapSchema here or can we create our own
  // thing that's simpler.
  return mapSchema(schema, {
    [MapperKind.MUTATION_ROOT_FIELD]: (fieldConfig) => {
      const mutation = operationMap.get(OperationTypeNode.MUTATION);
      if (mutation != null) {
        return applyRootSource(fieldConfig, mutation);
      }
      return fieldConfig;
    },
    [MapperKind.QUERY_ROOT_FIELD]: (fieldConfig) => {
      const query = operationMap.get(OperationTypeNode.MUTATION);
      if (query != null) {
        return applyRootSource(fieldConfig, query);
      }
      return fieldConfig;
    },
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      let newFieldConfig = fieldConfig;

      const methodNameDirective = getDirective(
        schema,
        fieldConfig,
        METHOD_NAME_DIRECTIVE,
      )?.[0];
      if (methodNameDirective != null) {
        newFieldConfig = applyMethodNameDirective(
          newFieldConfig,
          methodNameDirective,
        );
      }

      const exportedDirective = getDirective(
        schema,
        fieldConfig,
        EXPORTED_DIRECTIVE,
      )?.[0];

      if (exportedDirective != null) {
        newFieldConfig = applyExportDirective(
          newFieldConfig,
          exportedDirective,
        );
      }

      return newFieldConfig;
    },
  });
}

/**
 * Field renaming directive:
 *
 * By default, when resolving a field, the server will take the schema field
 * name, and look for a resolver/property by that name on the parent object.
 * Since we support exposing a method/property under a different name, we need
 * to modify that field's resolver to look for the implementation name rather
 * than the schema name.
 */
function applyMethodNameDirective(
  fieldConfig: GraphQLFieldConfig<any, any, any>,
  methodNameDirective: Record<string, any>,
): GraphQLFieldConfig<any, any, any> {
  const { resolve = defaultFieldResolver } = fieldConfig;
  return {
    ...fieldConfig,
    resolve(source, args, context, info) {
      const newInfo = {
        ...info,
        fieldName: methodNameDirective[METHOD_NAME_ARG],
      };
      return resolve(source, args, context, newInfo);
    },
  };
}

/**
 * Export directive:
 *
 * By default, when resolving a field, the server will look for a resolver
 * function on the parent object. This directive allows you to specify a
 * module and function name to import and use as the resolver.
 */
function applyExportDirective(
  fieldConfig: GraphQLFieldConfig<any, any, any>,
  methodNameDirective: Record<string, any>,
): GraphQLFieldConfig<any, any, any> {
  // TODO: Does this work in the browser?
  const filename = resolveRelativePath(
    methodNameDirective[EXPORTED_FILENAME_ARG],
  );
  const functionName = methodNameDirective[EXPORTED_FUNCTION_NAME_ARG];
  return {
    ...fieldConfig,
    async resolve(source, args, context, info) {
      let mod: any = {};
      try {
        mod = await import(filename);
      } catch (e) {
        console.error(
          `Grats Error: Failed to import module \`${filename}\`. You may need to rerun Grats.`,
        );
        throw e;
      }
      const resolve = mod[functionName];
      if (typeof resolve !== "function") {
        throw new Error(
          `Grats Error: Expected \`${filename}\` to have a named export \`${functionName}\` that is a function, but it was \`${typeof resolve}\`. You may need to rerun Grats.`,
        );
      }
      return resolve(source, args, context, info);
    },
  };
}

/**
 * How does the GraphQL executor get access to the root object for a query or
 * mutation?
 */
function applyRootSource(
  fieldConfig: GraphQLFieldConfig<any, any, any>,
  operationTypeDirective: Record<string, any>,
): GraphQLFieldConfig<any, any, any> {
  const { resolve = defaultFieldResolver } = fieldConfig;
  // TODO: Does this work in the browser?
  const filename = resolveRelativePath(
    operationTypeDirective[EXPORTED_OPERATION_FILENAME_ARG],
  );
  const functionName =
    operationTypeDirective[EXPORTED_OPERATION_FUNCTION_NAME_ARG];
  return {
    ...fieldConfig,
    async resolve(_source, args, context, info) {
      let mod: any = {};
      try {
        mod = await import(filename);
      } catch (e) {
        console.error(
          `Grats Error: Failed to import module \`${filename}\`. You may need to rerun Grats.`,
        );
        throw e;
      }
      const getSource = mod[functionName];
      if (typeof getSource !== "function") {
        throw new Error(
          `Grats Error: Expected \`${filename}\` to have a named export \`${functionName}\` that is a function, but it was \`${typeof getSource}\`. You may need to rerun Grats.`,
        );
      }

      const source = getSource();
      return resolve(source, args, context, info);
    },
  };
}

function getOperationMap(
  schema: GraphQLSchema,
): Map<OperationTypeNode, Record<string, any>> {
  const operationMap = new Map();

  const exportedOperations = getDirective(
    schema,
    schema,
    EXPORTED_OPERATION_DIRECTIVE,
  );
  if (exportedOperations != null) {
    for (const exportedOperation of exportedOperations) {
      operationMap.set(
        exportedOperation[EXPORTED_OPERATION_OPERATION_ARG],
        exportedOperation,
      );
    }
  }

  return operationMap;
}
