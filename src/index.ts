import {
  buildASTSchema,
  defaultFieldResolver,
  DefinitionNode,
  DocumentNode,
  GraphQLSchema,
  Kind,
  parse,
  validateSchema,
} from "graphql";
import { graphQlErrorToDiagnostic } from "./utils/DiagnosticError";
import * as ts from "typescript";
import { Extractor } from "./Extractor";
import { TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";

export * from "./Types";

const DIRECTIVES_AST = parse(`
  directive @renameField(name: String!) on FIELD_DEFINITION
`);

// Construct a schema, using GraphQL schema language
export function buildSchema(files: string[]): GraphQLSchema {
  const doc = buildSchemaAst(files);

  // const schema = buildASTSchema(doc, { assumeValidSDL: true });
  const schema = buildASTSchema(doc, {
    assumeValidSDL: true,
  });

  const schemaValidationErrors = validateSchema(schema);
  if (schemaValidationErrors.length > 0) {
    const firstError = schemaValidationErrors[0];
    // FIXME: Handle the error that Query is not defined
    if (firstError.source && firstError.locations && firstError.positions) {
      throw graphQlErrorToDiagnostic(firstError);
    }
  }
  return applyServerDirectives(schema);
}

export function buildSchemaAst(files: string[]): DocumentNode {
  const doc = definitionsFromFile(files);

  // TODO: Currently this does not detect definitions that shadow builtins
  // (`String`, `Int`, etc). However, if we pass a second param (extending an
  // existing schema) we do! So, we should find a way to validate that we don't
  // shadow builtins.
  const validationErrors = validateSDL(doc);
  if (validationErrors.length > 0) {
    // TODO: Report all errors
    throw graphQlErrorToDiagnostic(validationErrors[0]);
  }
  return doc;
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
function applyServerDirectives(schema: GraphQLSchema): GraphQLSchema {
  // TODO: Do we really need all of mapSchema here or can we create our own
  // thing that's simpler.
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const rename = getDirective(schema, fieldConfig, "renameField")?.[0];
      if (!rename) return;
      const { resolve = defaultFieldResolver } = fieldConfig;
      return {
        ...fieldConfig,
        resolve(source, args, context, info) {
          const newInfo = { ...info, fieldName: rename.name };
          return resolve(source, args, context, newInfo);
        },
      };
    },
  });
}

function definitionsFromFile(filePaths: string[]): DocumentNode {
  // https://stackoverflow.com/a/66604532/1263117
  const options: ts.CompilerOptions = { allowJs: true };
  const compilerHost = ts.createCompilerHost(
    options,
    /* setParentNodes this is needed for finding jsDocs */
    true,
  );
  const program = ts.createProgram(filePaths, options, compilerHost);
  const checker = program.getTypeChecker();
  const ctx = new TypeContext(checker);

  const definitions: DefinitionNode[] = Array.from(DIRECTIVES_AST.definitions);
  for (const filePath of filePaths) {
    // TODO: More robust file extension detection
    if (
      filePath.endsWith(".ts") ||
      filePath.endsWith(".js") ||
      filePath.endsWith(".jsx") ||
      filePath.endsWith(".tsx")
    ) {
      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) {
        throw new Error(`Could not find source file ${filePath}`);
      }

      const extractor = new Extractor(sourceFile, ctx);
      const extracted = extractor.extract();
      for (const definition of extracted) {
        definitions.push(definition);
      }
    }
  }

  return ctx.resolveTypes({ kind: Kind.DOCUMENT, definitions });
}
