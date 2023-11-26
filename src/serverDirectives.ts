import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import {
  defaultFieldResolver,
  DocumentNode,
  GraphQLFieldConfig,
  GraphQLSchema,
  parse,
} from "graphql";
import { resolveRelativePath } from "./gratsRoot";

// TODO: Rename to be generic since it can apply to properties as well as methods.
export const METHOD_NAME_DIRECTIVE = "methodName";
export const METHOD_NAME_ARG = "name";
export const EXPORTED_DIRECTIVE = "exported";
export const JS_MODULE_PATH_ARG = "jsModulePath";
export const TS_MODULE_PATH_ARG = "tsModulePath";
export const EXPORTED_FUNCTION_NAME_ARG = "functionName";

export const DIRECTIVES_AST: DocumentNode = parse(`
    directive @${METHOD_NAME_DIRECTIVE}(${METHOD_NAME_ARG}: String!) on FIELD_DEFINITION
    directive @${EXPORTED_DIRECTIVE}(
      ${JS_MODULE_PATH_ARG}: String!,
      ${TS_MODULE_PATH_ARG}: String!,
      ${EXPORTED_FUNCTION_NAME_ARG}: String!
    ) on FIELD_DEFINITION
`);

export function applyServerDirectives(schema: GraphQLSchema): GraphQLSchema {
  // TODO: Throw if the schema is missing our directives!

  // TODO: Do we really need all of mapSchema here or can we create our own
  // thing that's simpler.
  return mapSchema(schema, {
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
  const jsModulePath = resolveRelativePath(
    methodNameDirective[JS_MODULE_PATH_ARG],
  );
  const tsModulePath = resolveRelativePath(
    methodNameDirective[TS_MODULE_PATH_ARG],
  );
  const functionName = methodNameDirective[EXPORTED_FUNCTION_NAME_ARG];
  let mod: Record<string, any> | undefined = undefined;
  let modPromise: Promise<Record<string, any>> | undefined = undefined;
  return {
    ...fieldConfig,
    async resolve(source, args, context, info) {
      if (modPromise == null) {
        modPromise = importWithFallback(jsModulePath, tsModulePath);
      }
      if (mod == null) {
        try {
          mod = await modPromise;
        } catch (e) {
          console.error(loadModuleErrorMessage(jsModulePath, tsModulePath));
          throw e;
        }
      }
      const resolve = mod[functionName];
      if (typeof resolve !== "function") {
        // TODO: Better error message that indicates if it was loaded from JS or TS.
        throw new Error(
          `Grats Error: Expected \`${tsModulePath}\` to have a named export \`${functionName}\` that is a function, but it was \`${typeof resolve}\`. You may need to rerun Grats or regenerate the JavaScript version of your module by rerunning the TypeScript compiler.`,
        );
      }
      return resolve(source, args, context, info);
    },
  };
}

// When people use Grats with loaders like `esbuild-register` or `ts-node`, the
// compiled JavaScript version of the file may not exist on disk. In these specific
// cases, esbuild or ts-node can load the file via its TypeScript source, so we try
// falling back to that.
async function importWithFallback(
  jsModulePath: string,
  tsModulePath: string,
): Promise<Record<string, any>> {
  try {
    // We start with the .ts version because if both exist, and can be loaded, the .ts version is
    // going to be more up to date. The downside is that this causes some extra work to be done in
    // in prod. This should be manageable since we cache the loaded module for each field.

    // It's important that we await here so that we catch the error if the module doesn't exist or
    // cannot be parsed.
    return await import(tsModulePath);
  } catch (e) {
    return await import(jsModulePath);
  }
}

function loadModuleErrorMessage(jsPath: string, tsPath: string): string {
  return `Grats Error: Failed to import module. Tried loading from two locations:
* \`${jsPath}\`
* \`${tsPath}\`

This can happen for a few reasons:

* You resolver has moved and you need to rerun Grats to regenerate your schema.
* Your TypeScript code has changed and you need to rerun \`tsc\` to generate the JavaScript variant of the file.
* You compiled your TypeScript with a different TSConfig than what you ran Grats with.
* The Grats NPM module moved between when you ran Grats and when you ran your server.`;
}
