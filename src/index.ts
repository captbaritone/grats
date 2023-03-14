import {
  buildASTSchema,
  defaultFieldResolver,
  DefinitionNode,
  DocumentNode,
  extendSchema,
  GraphQLSchema,
  Kind,
  parse,
} from "graphql";
import { glob } from "glob";
import { graphQlErrorToDiagnostic } from "./utils/DiagnosticError";
import * as ts from "typescript";
import { Extractor } from "./Extractor";
import { TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";

export * from "./Types";

const DIRECTIVES = `
  directive @renameField(name: String!) on FIELD_DEFINITION
`;

const BASE_SCHEMA = buildASTSchema(parse(DIRECTIVES));

// Construct a schema, using GraphQL schema language
export async function buildSchema(pattern: string): Promise<GraphQLSchema> {
  const files = await glob(pattern);

  const doc = definitionsFromFile(files);

  const validationErrors = validateSDL(doc, BASE_SCHEMA);
  if (validationErrors.length > 0) {
    // TODO: Report all errors
    const diagnostic = graphQlErrorToDiagnostic(validationErrors[0]);
    throw diagnostic;
  }

  const schema = extendSchema(BASE_SCHEMA, doc);
  return applyServerDirectives(schema);
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
  let program = ts.createProgram(filePaths, options, compilerHost);
  const checker = program.getTypeChecker();
  const ctx = new TypeContext(checker);

  const definitions: DefinitionNode[] = [];
  for (const filePath of filePaths) {
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

  return ctx.resolveTypes({ kind: Kind.DOCUMENT, definitions });
}
