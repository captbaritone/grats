import {
  buildASTSchema,
  DocumentNode,
  GraphQLSchema,
  Kind,
  validateSchema,
} from "graphql";
import {
  ok,
  err,
  graphQlErrorToDiagnostic,
  DiagnosticsResult,
  Result,
  ReportableDiagnostics,
  combineResults,
} from "./utils/DiagnosticError";
import * as ts from "typescript";
import { ExtractionSnapshot } from "./Extractor";
import { TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { ParsedCommandLineGrats } from "./gratsConfig";
import { validateTypenames } from "./validations/validateTypenames";
import { snapshotsFromProgram } from "./transforms/snapshotsFromProgram";
import { validateMergedInterfaces } from "./validations/validateMergedInterfaces";
import { validateContextReferences } from "./validations/validateContextReferences";
import { GratsDefinitionNode } from "./GraphQLConstructor";
import { DIRECTIVES_AST } from "./metadataDirectives";
import { extend } from "./utils/helpers";
import { addInterfaceFields } from "./transforms/addInterfaceFields";
import { filterNonGqlInterfaces } from "./transforms/filterNonGqlInterfaces";
import { resolveTypes } from "./transforms/resolveTypes";
import { validateAsyncIterable } from "./validations/validateAsyncIterable";

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
  const schemaResult = extractSchema(options, compilerHost);
  if (schemaResult.kind === "ERROR") {
    return err(new ReportableDiagnostics(compilerHost, schemaResult.err));
  }

  return ok(schemaResult.value);
}

function extractSchema(
  options: ParsedCommandLineGrats,
  host: ts.CompilerHost,
): DiagnosticsResult<GraphQLSchema> {
  const program = ts.createProgram(options.fileNames, options.options, host);

  const snapshotsResult = snapshotsFromProgram(program, options);
  if (snapshotsResult.kind === "ERROR") {
    return snapshotsResult;
  }

  const snapshot = reduceSnapshots(snapshotsResult.value);

  const docResult = docFromSnapshot(program, host, snapshot);

  if (docResult.kind === "ERROR") {
    return docResult;
  }

  return buildSchemaFromDocumentNode(
    docResult.value,
    snapshot.typesWithTypenameField,
  );
}

// Given a SDL AST, build and validate a GraphQLSchema.
function buildSchemaFromDocumentNode(
  doc: DocumentNode,
  typesWithTypenameField: Set<string>,
): DiagnosticsResult<GraphQLSchema> {
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

/**
 * Given a merged snapshot representing the whole program, construct a GraphQL
 * schema document with metadata directives attached.
 */
export function docFromSnapshot(
  program: ts.Program,
  host: ts.CompilerHost,
  snapshot: ExtractionSnapshot,
): DiagnosticsResult<DocumentNode> {
  const checker = program.getTypeChecker();
  const ctx = new TypeContext(checker, host);

  // Validate the snapshot
  const mergedResult = combineResults(
    validateMergedInterfaces(checker, snapshot.interfaceDeclarations),
    validateContextReferences(ctx, snapshot.contextReferences),
  );
  if (mergedResult.kind === "ERROR") {
    return mergedResult;
  }

  // Propagate snapshot data to type context

  for (const [node, typeName] of snapshot.unresolvedNames) {
    ctx.markUnresolvedType(node, typeName);
  }

  for (const [node, definition] of snapshot.nameDefinitions) {
    ctx.recordTypeName(node, definition.name, definition.kind);
  }

  // Fixup the schema SDL

  const definitions: GratsDefinitionNode[] = Array.from(
    DIRECTIVES_AST.definitions,
  );

  extend(definitions, snapshot.definitions);

  // If you define a field on an interface using the functional style, we need to add
  // that field to each concrete type as well. This must be done after all types are created,
  // but before we validate the schema.
  const definitionsResult = addInterfaceFields(ctx, definitions);
  if (definitionsResult.kind === "ERROR") {
    return definitionsResult;
  }

  const filteredDoc = filterNonGqlInterfaces(ctx, {
    kind: Kind.DOCUMENT,
    definitions: definitionsResult.value,
  });

  const docResult = resolveTypes(ctx, filteredDoc);
  if (docResult.kind === "ERROR") return docResult;

  const doc = docResult.value;

  const subscriptionsValidationResult = validateAsyncIterable(doc);
  if (subscriptionsValidationResult.kind === "ERROR") {
    return subscriptionsValidationResult;
  }

  return ok(doc);
}

// Given a list of snapshots, merge them into a single snapshot.
function reduceSnapshots(snapshots: ExtractionSnapshot[]): ExtractionSnapshot {
  const result: ExtractionSnapshot = {
    definitions: [],
    nameDefinitions: new Map(),
    unresolvedNames: new Map(),
    contextReferences: [],
    typesWithTypenameField: new Set(),
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

    for (const typeName of snapshot.typesWithTypenameField) {
      result.typesWithTypenameField.add(typeName);
    }

    for (const interfaceDeclaration of snapshot.interfaceDeclarations) {
      result.interfaceDeclarations.push(interfaceDeclaration);
    }
  }

  return result;
}
