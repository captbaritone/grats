import {
  buildASTSchema,
  DocumentNode,
  GraphQLSchema,
  Kind,
  validateSchema,
} from "graphql";
import {
  graphQlErrorToDiagnostic,
  DiagnosticsWithoutLocationResult,
  ReportableDiagnostics,
} from "./utils/DiagnosticError";
import { concatResults } from "./utils/Result";
import { ok, err } from "./utils/Result";
import { Result } from "./utils/Result";
import * as ts from "typescript";
import { ExtractionSnapshot } from "./Extractor";
import { TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { ParsedCommandLineGrats } from "./gratsConfig";
import { validateTypenames } from "./validations/validateTypenames";
import { snapshotsFromProgram as extractSnapshotsFromProgram } from "./transforms/snapshotsFromProgram";
import { validateMergedInterfaces } from "./validations/validateMergedInterfaces";
import { validateContextReferences } from "./validations/validateContextReferences";
import { withDirectives as addMetadataDirectives } from "./metadataDirectives";
import { addInterfaceFields } from "./transforms/addInterfaceFields";
import { filterNonGqlInterfaces } from "./transforms/filterNonGqlInterfaces";
import { resolveTypes } from "./transforms/resolveTypes";
import { validateAsyncIterable } from "./validations/validateAsyncIterable";
import { applyDefaultNullability } from "./transforms/applyDefaultNullability";

export * from "./gratsConfig";

// Construct a schema, using GraphQL schema language
// Exported for tests that want to intercept diagnostic errors.
export function buildSchemaResult(
  options: ParsedCommandLineGrats,
): Result<GraphQLSchema, ReportableDiagnostics> {
  // https://stackoverflow.com/a/66604532/1263117
  const compilerHost = ts.createCompilerHost(
    options.options,
    /* setParentNodes this is needed for finding jsDocs */
    true,
  );

  return buildSchemaResultWithHost(options, compilerHost);
}

export function buildSchemaResultWithHost(
  options: ParsedCommandLineGrats,
  compilerHost: ts.CompilerHost,
): Result<GraphQLSchema, ReportableDiagnostics> {
  const program = ts.createProgram(
    options.fileNames,
    options.options,
    compilerHost,
  );
  return extractSchema(options, program).mapErr(
    (e) => new ReportableDiagnostics(compilerHost, e),
  );
}

/**
 * The core transformation pipeline of Grats.
 */
export function extractSchema(
  options: ParsedCommandLineGrats,
  program: ts.Program,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  return extractSnapshotsFromProgram(program, options)
    .map((snapshots) => combineSnapshots(snapshots))
    .andThen((snapshot) => {
      const { typesWithTypename } = snapshot;
      const { nullableByDefault } = options.raw.grats;
      const checker = program.getTypeChecker();
      const ctx = TypeContext.fromSnapshot(checker, snapshot);

      // Collect validation errors
      const validationResult = concatResults(
        validateMergedInterfaces(checker, snapshot.interfaceDeclarations),
        validateContextReferences(ctx, snapshot.contextReferences),
      );

      return (
        validationResult
          // Add the metadata directive definitions to definitions
          // found in the snapshot.
          .map(() => addMetadataDirectives(snapshot.definitions))
          // If you define a field on an interface using the functional style, we need to add
          // that field to each concrete type as well. This must be done after all types are created,
          // but before we validate the schema.
          .andThen((definitions) => addInterfaceFields(ctx, definitions))
          // Convert the definitions into a DocumentNode
          .map((definitions) => ({ kind: Kind.DOCUMENT, definitions } as const))
          // Filter out any `implements` clauses that are not GraphQL interfaces.
          .map((doc) => filterNonGqlInterfaces(ctx, doc))
          // Apply default nullability to fields and arguments, and detect any misuse of
          // `@killsParentOnException`.
          .andThen((doc) => applyDefaultNullability(doc, nullableByDefault))
          // Resolve TypeScript type references to the GraphQL types they represent (or error).
          .andThen((doc) => resolveTypes(ctx, doc))
          // Ensure all subscription fields, and _only_ subscription fields, return an AsyncIterable.
          .andThen((doc) => validateAsyncIterable(doc))
          // Build and validate the schema with regards to the GraphQL spec.
          .andThen((doc) => buildSchemaFromDocumentNode(doc, typesWithTypename))
      );
    });
}

// Given a SDL AST, build and validate a GraphQLSchema.
function buildSchemaFromDocumentNode(
  doc: DocumentNode,
  typesWithTypenameField: Set<string>,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
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
  const schema = buildASTSchema(doc, { assumeValidSDL: true });

  const diagnostics = validateSchema(schema)
    // FIXME: Handle case where query is not defined (no location)
    .filter((e) => e.source && e.locations && e.positions)
    .map((e) => graphQlErrorToDiagnostic(e));

  if (diagnostics.length > 0) {
    return err(diagnostics);
  }

  const typenameDiagnostics = validateTypenames(schema, typesWithTypenameField);
  if (typenameDiagnostics.length > 0) return err(typenameDiagnostics);

  return ok(schema);
}

// Given a list of snapshots, merge them into a single snapshot.
function combineSnapshots(snapshots: ExtractionSnapshot[]): ExtractionSnapshot {
  const result: ExtractionSnapshot = {
    definitions: [],
    nameDefinitions: new Map(),
    unresolvedNames: new Map(),
    contextReferences: [],
    typesWithTypename: new Set(),
    interfaceDeclarations: [],
  };

  for (const snapshot of snapshots) {
    for (const definition of snapshot.definitions) {
      result.definitions.push(definition);
    }

    for (const [node, definition] of snapshot.nameDefinitions) {
      result.nameDefinitions.set(node, definition);
    }

    for (const [node, typeName] of snapshot.unresolvedNames) {
      result.unresolvedNames.set(node, typeName);
    }

    for (const contextReference of snapshot.contextReferences) {
      result.contextReferences.push(contextReference);
    }

    for (const typeName of snapshot.typesWithTypename) {
      result.typesWithTypename.add(typeName);
    }

    for (const interfaceDeclaration of snapshot.interfaceDeclarations) {
      result.interfaceDeclarations.push(interfaceDeclaration);
    }
  }

  return result;
}
