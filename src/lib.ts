import {
  buildASTSchema,
  DocumentNode,
  GraphQLSchema,
  Kind,
  validateSchema,
} from "graphql";
import {
  DiagnosticsWithoutLocationResult,
  ReportableDiagnostics,
  graphQlErrorToDiagnostic,
} from "./utils/DiagnosticError";
import { concatResults, ResultPipe } from "./utils/Result";
import { ok, err } from "./utils/Result";
import { Result } from "./utils/Result";
import * as ts from "typescript";
import { ExtractionSnapshot } from "./Extractor";
import { TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { ParsedCommandLineGrats } from "./gratsConfig";
import { validateTypenames } from "./validations/validateTypenames";
import { extractSnapshotsFromProgram } from "./transforms/snapshotsFromProgram";
import { validateMergedInterfaces } from "./validations/validateMergedInterfaces";
import { addInterfaceFields } from "./transforms/addInterfaceFields";
import { filterNonGqlInterfaces } from "./transforms/filterNonGqlInterfaces";
import { validateAsyncIterable } from "./validations/validateAsyncIterable";
import { applyDefaultNullability } from "./transforms/applyDefaultNullability";
import { mergeExtensions } from "./transforms/mergeExtensions";
import { sortSchemaAst } from "./transforms/sortSchemaAst";
import { validateDuplicateContextOrInfo } from "./validations/validateDuplicateContextOrInfo";
import { validateSemanticNullability } from "./validations/validateSemanticNullability";
import { resolveTypes } from "./transforms/resolveTypes";
import { resolveResolverParams } from "./transforms/resolveResolverParams";
import { customSpecValidations } from "./validations/customSpecValidations";
import { makeResolverSignature } from "./transforms/makeResolverSignature";
import { addImplicitRootTypes } from "./transforms/addImplicitRootTypes";
import { addImportedSchemas } from "./transforms/addImportedSchemas";
import { Metadata } from "./metadata";

// Export the TypeScript plugin implementation used by
// grats-ts-plugin
export { initTsPlugin } from "./tsPlugin/initTsPlugin";

export { GratsConfig } from "./gratsConfig";

export type SchemaAndDoc = {
  schema: GraphQLSchema;
  doc: DocumentNode;
  resolvers: Metadata;
};

// Construct a schema, using GraphQL schema language
// Exported for tests that want to intercept diagnostic errors.
export function buildSchemaAndDocResult(
  options: ParsedCommandLineGrats,
): Result<SchemaAndDoc, ReportableDiagnostics> {
  // https://stackoverflow.com/a/66604532/1263117
  const compilerHost = ts.createCompilerHost(
    options.options,
    /* setParentNodes this is needed for finding jsDocs */
    true,
  );

  return buildSchemaAndDocResultWithHost(options, compilerHost);
}

export function buildSchemaAndDocResultWithHost(
  options: ParsedCommandLineGrats,
  compilerHost: ts.CompilerHost,
): Result<SchemaAndDoc, ReportableDiagnostics> {
  const program = ts.createProgram(
    options.fileNames,
    options.options,
    compilerHost,
  );
  return new ResultPipe(extractSchemaAndDoc(options, program))
    .mapErr((e) => new ReportableDiagnostics(compilerHost, e))
    .result();
}

/**
 * The core transformation pipeline of Grats.
 */
export function extractSchemaAndDoc(
  options: ParsedCommandLineGrats,
  program: ts.Program,
): DiagnosticsWithoutLocationResult<SchemaAndDoc> {
  return new ResultPipe(extractSnapshotsFromProgram(program, options))
    .map((snapshots) => combineSnapshots(snapshots))
    .andThen((snapshot) => {
      const { typesWithTypename } = snapshot;
      const config = options.raw.grats;
      const checker = program.getTypeChecker();
      const ctx = TypeContext.fromSnapshot(checker, snapshot);

      // Collect validation errors
      const validationResult = concatResults(
        validateMergedInterfaces(checker, snapshot.interfaceDeclarations),
        validateDuplicateContextOrInfo(ctx),
      );

      const docResult = new ResultPipe(validationResult)
        // Filter out any `implements` clauses that are not GraphQL interfaces.
        .map(() => filterNonGqlInterfaces(ctx, snapshot.definitions))
        .andThen((definitions) => resolveResolverParams(ctx, definitions))
        .andThen((definitions) => resolveTypes(ctx, definitions))
        // If you define a field on an interface using the functional style, we need to add
        // that field to each concrete type as well. This must be done after all types are created,
        // but before we validate the schema.
        .andThen((definitions) => addInterfaceFields(ctx, definitions))
        // Convert the definitions into a DocumentNode
        .map((definitions) => ({ kind: Kind.DOCUMENT, definitions } as const))
        // Ensure all subscription fields return an AsyncIterable.
        .andThen((doc) => validateAsyncIterable(doc))
        // Apply default nullability to fields and arguments, and detect any misuse of
        // `@killsParentOnException`.
        .andThen((doc) => applyDefaultNullability(doc, config))
        // Ensure we have Query/Mutation/Subscription types if they've been extended with
        // `@gqlQueryField` and friends.
        .map((doc) => addImplicitRootTypes(doc))
        // Merge any `extend` definitions into their base definitions.
        .map((doc) => mergeExtensions(ctx, doc))
        // Perform custom validations that reimplement spec validation rules
        // with more tailored error messages.
        .andThen((doc) => customSpecValidations(doc))
        // Sort the definitions in the document to ensure a stable output.
        .map((doc) => sortSchemaAst(doc))
        .andThen((doc) => addImportedSchemas(ctx, doc))
        .result();

      if (docResult.kind === "ERROR") {
        return docResult;
      }
      const { gratsDoc, externalDocs } = docResult.value;
      const resolvers = makeResolverSignature(gratsDoc);

      // Build and validate the schema with regards to the GraphQL spec.
      return (
        new ResultPipe(buildSchemaFromDoc([gratsDoc, ...externalDocs]))
          // Ensure that every type which implements an interface or is a member of a
          // union has a __typename field.
          .andThen((schema) => validateTypenames(schema, typesWithTypename))
          .andThen((schema) => validateSemanticNullability(schema, config))
          // Combine the schema and document into a single result.
          .map((schema) => ({ schema, doc: gratsDoc, resolvers }))
          .result()
      );
    })
    .result();
}

// Given a SDL AST, build and validate a GraphQLSchema.
function buildSchemaFromDoc(
  docs: DocumentNode[],
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  // TODO: Currently this does not detect definitions that shadow builtins
  // (`String`, `Int`, etc). However, if we pass a second param (extending an
  // existing schema) we do! So, we should find a way to validate that we don't
  // shadow builtins.
  const doc: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: docs.flatMap((doc) => doc.definitions),
  };
  const validationErrors = validateSDL(doc);
  if (validationErrors.length > 0) {
    return err(validationErrors.map(graphQlErrorToDiagnostic));
  }
  const schema = buildASTSchema(doc, { assumeValidSDL: true });

  const diagnostics = validateSchema(schema)
    // FIXME: Handle case where query is not defined (no location)
    .filter((e) => e.source && e.locations && e.positions);
  //
  if (diagnostics.length > 0) {
    return err(diagnostics.map(graphQlErrorToDiagnostic));
  }

  return ok(schema);
}

// Given a list of snapshots, merge them into a single snapshot.
function combineSnapshots(snapshots: ExtractionSnapshot[]): ExtractionSnapshot {
  const result: ExtractionSnapshot = {
    definitions: [],
    nameDefinitions: new Map(),
    unresolvedNames: new Map(),
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

    for (const typeName of snapshot.typesWithTypename) {
      result.typesWithTypename.add(typeName);
    }

    for (const interfaceDeclaration of snapshot.interfaceDeclarations) {
      result.interfaceDeclarations.push(interfaceDeclaration);
    }
  }

  return result;
}
