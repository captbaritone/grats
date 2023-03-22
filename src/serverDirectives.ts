import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import { defaultFieldResolver, GraphQLSchema, parse } from "graphql";

export const METHOD_NAME_DIRECTIVE = "methodName";
export const METHOD_NAME_ARG = "name";

export const DIRECTIVES_AST = parse(`
    directive @${METHOD_NAME_DIRECTIVE}(${METHOD_NAME_ARG}: String!) on FIELD_DEFINITION
`);

/**
 * Field renaming directive:
 *
 * By default, when resolving a field, the server will take the schema field
 * name, and look for a resolver/property by that name on the parent object.
 * Since we support exposing a method/property under a different name, we need
 * to modify that field's resolver to look for the implementation name rather
 * than the schema name.
 */
export function applyServerDirectives(schema: GraphQLSchema): GraphQLSchema {
  // TODO: Do we really need all of mapSchema here or can we create our own
  // thing that's simpler.
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const methodNameDirective = getDirective(
        schema,
        fieldConfig,
        METHOD_NAME_DIRECTIVE,
      )?.[0];
      if (!methodNameDirective) return;
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
    },
  });
}
