import {
  buildASTSchema,
  defaultFieldResolver,
  DefinitionNode,
  DocumentNode,
  GraphQLSchema,
  Kind,
  parse,
  printSchema,
  validateSchema,
  lexicographicSortSchema,
} from "graphql";
import {
  ok,
  err,
  graphQlErrorToDiagnostic,
  DiagnosticsResult,
  Result,
  ReportableDiagnostics,
} from "./utils/DiagnosticError";
import * as ts from "typescript";
import { Extractor } from "./Extractor";
import { TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import * as fs from "fs";

export * from "./Types";

const DIRECTIVES_AST = parse(`
  directive @renameField(name: String!) on FIELD_DEFINITION
`);

export type BuildOptions = {
  // The set of files which might contain GraphQL definitions.
  // TODO: Can we get rid of this and just use the tsconfig and search through
  // _all_ files?
  files: string[];

  // Should we write a schema file to disk? If so, where?
  // TODO: Clarify what this path is relative to.
  emitSchemaFile?: string;

  // Should all fields be typed as nullable in accordance with GraphQL best practices?
  // https://graphql.org/learn/best-practices/#nullability
  nullableByDefault?: boolean;
};

// Build an executable schema from a set of files. Note that if extraction
// fails, this function will exit the process and print a helpful error
// message.
export function buildSchema(options: BuildOptions): GraphQLSchema {
  const schemaResult = buildSchemaResult(options);
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }
  return schemaResult.value;
}

// Construct a schema, using GraphQL schema language
// Exported for tests that want to intercept diagnostic errors.
export function buildSchemaResult(
  options: BuildOptions,
): Result<GraphQLSchema, ReportableDiagnostics> {
  // https://stackoverflow.com/a/66604532/1263117
  const compilerOptions: ts.CompilerOptions = { allowJs: true };
  const compilerHost = ts.createCompilerHost(
    options,
    /* setParentNodes this is needed for finding jsDocs */
    true,
  );

  const docResult = buildSchemaAst(options, compilerHost, compilerOptions);
  if (docResult.kind === "ERROR") {
    return err(new ReportableDiagnostics(compilerHost, docResult.err));
  }
  const doc = docResult.value;

  // const schema = buildASTSchema(doc, { assumeValidSDL: true });
  const schema = buildASTSchema(doc, { assumeValidSDL: true });

  const diagnostics = validateSchema(schema)
    // TODO: Handle case where query is not defined (no location)
    .filter((e) => e.source && e.locations && e.positions)
    .map((e) => graphQlErrorToDiagnostic(e));

  if (diagnostics.length > 0) {
    return err(new ReportableDiagnostics(compilerHost, diagnostics));
  }

  let runtimeSchema = applyServerDirectives(schema);

  if (options.emitSchemaFile) {
    runtimeSchema = lexicographicSortSchema(runtimeSchema);
    const sdl = printSchema(runtimeSchema);
    const filePath = options.emitSchemaFile ?? "./schema.graphql";
    fs.writeFileSync(filePath, sdl);
  }
  return ok(runtimeSchema);
}

export function buildSchemaAst(
  options: BuildOptions,
  host: ts.CompilerHost,
  compilerOptions: ts.CompilerOptions,
): DiagnosticsResult<DocumentNode> {
  const docResult = definitionsFromFile(options, host, compilerOptions);
  if (docResult.kind === "ERROR") {
    return docResult;
  }
  const doc = docResult.value;

  // TODO: Currently this does not detect definitions that shadow builtins
  // (`String`, `Int`, etc). However, if we pass a second param (extending an
  // existing schema) we do! So, we should find a way to validate that we don't
  // shadow builtins.
  const validationErrors = validateSDL(doc).map((e) => {
    return graphQlErrorToDiagnostic(e);
  });
  if (validationErrors.length > 0) {
    return err(validationErrors);
  }
  return ok(doc);
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

function definitionsFromFile(
  options: BuildOptions,
  host: ts.CompilerHost,
  compilerOptions: ts.CompilerOptions,
): DiagnosticsResult<DocumentNode> {
  const program = ts.createProgram(options.files, compilerOptions, host);
  const checker = program.getTypeChecker();
  const ctx = new TypeContext(checker, host);

  const definitions: DefinitionNode[] = Array.from(DIRECTIVES_AST.definitions);
  for (const source of program.getSourceFiles()) {
    const filePath = source.fileName;
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Could not find source file ${filePath}`);
    }

    const extractor = new Extractor(sourceFile, ctx, options);
    const extractedResult = extractor.extract();
    if (extractedResult.kind === "ERROR") {
      return extractedResult;
    } else {
      for (const definition of extractedResult.value) {
        definitions.push(definition);
      }
    }
  }

  return ctx.resolveTypes({ kind: Kind.DOCUMENT, definitions });
}
