import {
  buildASTSchema,
  DocumentNode,
  GraphQLError,
  GraphQLSchema,
  Kind,
  validateSchema,
} from "graphql";
import {
  DiagnosticsWithoutLocationResult,
  graphQlErrorToDiagnostic,
} from "./utils/DiagnosticError.js";
import { concatResults, ResultPipe } from "./utils/Result.js";
import { ok, err } from "./utils/Result.js";
import * as ts from "typescript";
import { ExtractionSnapshot } from "./Extractor.js";
import { TypeContext } from "./TypeContext.js";
import { CheckerNameResolver } from "./CheckerNameResolver.js";
import { validateSDL } from "graphql/validation/validate.js";
import { ParsedCommandLineGrats } from "./gratsConfig.js";
import { extractSnapshotsFromProgram } from "./transforms/snapshotsFromProgram.js";
import { validateMergedInterfaces } from "./validations/validateMergedInterfaces.js";
import { addInterfaceFields } from "./transforms/addInterfaceFields.js";
import { filterNonGqlInterfaces } from "./transforms/filterNonGqlInterfaces.js";
import { validateAsyncIterable } from "./validations/validateAsyncIterable.js";
import { applyDefaultNullability } from "./transforms/applyDefaultNullability.js";
import { mergeExtensions } from "./transforms/mergeExtensions.js";
import { sortSchemaAst } from "./transforms/sortSchemaAst.js";
import { validateDuplicateContextOrInfo } from "./validations/validateDuplicateContextOrInfo.js";
import { resolveTypes } from "./transforms/resolveTypes.js";
import { resolveResolverParams } from "./transforms/resolveResolverParams.js";
import { customSpecValidations } from "./validations/customSpecValidations.js";
import { makeResolverSignature } from "./transforms/makeResolverSignature.js";
import { addImplicitRootTypes } from "./transforms/addImplicitRootTypes.js";
import { Metadata } from "./metadata.js";
import { coerceDefaultEnumValues } from "./transforms/coerceDefaultEnumValues.js";
import { validateDocument } from "./rs/document.js";

export type { GratsConfig } from "./gratsConfig.js";

export type SchemaAndDoc = {
  schema: GraphQLSchema;
  doc: DocumentNode;
  resolvers: Metadata;
};

// Construct a schema, using GraphQL schema language
// Exported for tests that want to intercept diagnostic errors.
export function buildSchemaAndDocResult(
  options: ParsedCommandLineGrats,
): DiagnosticsWithoutLocationResult<SchemaAndDoc> {
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
): DiagnosticsWithoutLocationResult<SchemaAndDoc> {
  const program = ts.createProgram(
    options.fileNames,
    options.options,
    compilerHost,
  );
  return extractSchemaAndDoc(options, program);
}

/**
 * The core transformation pipeline of Grats.
 *
 * To keep the Grats codebase clean and maintainable, we've broken the
 * implementation into a series of transformations that each perform a small,
 * well-defined task.
 *
 * This function orchestrates the transformations and, as such, gives a good
 * high-level overview of how Grats works.
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
      const resolver = new CheckerNameResolver(program);
      const ctxResult = TypeContext.fromSnapshot(resolver, snapshot);
      if (ctxResult.kind === "ERROR") {
        return ctxResult;
      }
      const ctx = ctxResult.value;

      // Collect validation errors
      const validationResult = concatResults(
        validateMergedInterfaces(resolver, snapshot.interfaceDeclarations),
        validateDuplicateContextOrInfo(
          Array.from(snapshot.nameDefinitions.values(), (n) => n.definition),
        ),
      );

      const docResult = new ResultPipe(validationResult)
        // Filter out any `implements` clauses that are not GraphQL interfaces.
        .map(() => filterNonGqlInterfaces(ctx, snapshot.definitions))
        // Determine which positional resolver arguments: GraphQL arguments,
        // context, derived context, or info.
        .andThen((definitions) => resolveResolverParams(ctx, definitions))
        // Follow TypeScript type references to determine the GraphQL types
        // being referenced.
        .andThen((definitions) => resolveTypes(ctx, definitions))
        // Convert string literals used as default values for enums into GraphQL
        // enums where appropriate.
        .map((definitions) => coerceDefaultEnumValues(definitions))
        // If you define a field on an interface using the functional style, we
        // need to add that field to each concrete type as well. This must be
        // done after all types are created, but before we validate the schema.
        .andThen((definitions) => addInterfaceFields(ctx, definitions))
        // Convert the definitions into a DocumentNode
        .map((definitions) => ({ kind: Kind.DOCUMENT, definitions }) as const)
        // Ensure all subscription fields return an AsyncIterable.
        .andThen((doc) => validateAsyncIterable(doc))
        // Apply default nullability to fields and arguments, and detect any misuse of
        // `@killsParentOnException`.
        .andThen((doc) => applyDefaultNullability(doc, config))
        // Ensure we have Query/Mutation/Subscription types if they've been extended with
        // `@gqlQueryField` and friends.
        .map((doc) => addImplicitRootTypes(doc))
        // Merge any `extend` definitions into their base definitions.
        .map((doc) => mergeExtensions(doc))
        // Perform custom validations that reimplement spec validation rules
        // with more tailored error messages.
        .andThen((doc) => customSpecValidations(doc))
        // Sort the definitions in the document to ensure a stable output.
        .map((doc) => sortSchemaAst(doc))
        .andThen((doc) => specValidateSDL(doc))
        .result();

      if (docResult.kind === "ERROR") {
        return docResult;
      }
      const doc = docResult.value;
      const resolvers = makeResolverSignature(doc);

      // Build and validate the schema with regards to the GraphQL spec.
      return (
        new ResultPipe(buildSchema(doc))
          // Apply the "Type Validation" sub-sections of the specification's
          // "Type System" section.
          .andThen((schema) => specSchemaValidation(schema))
          // Run the validations that have been ported to Rust.
          .andThen((schema) =>
            new ResultPipe(validateDocument(doc, config, typesWithTypename))
              .map(() => schema)
              .result(),
          )
          // Combine the schema, document and resolver metadata into a single
          // result.
          .map((schema) => ({ schema, doc, resolvers }))
          .result()
      );
    })
    .result();
}

function buildSchema(
  doc: DocumentNode,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  return ok(buildASTSchema(doc, { assumeValidSDL: true }));
}

function specValidateSDL(
  doc: DocumentNode,
): DiagnosticsWithoutLocationResult<DocumentNode> {
  // TODO: Currently this does not detect definitions that shadow builtins
  // (`String`, `Int`, etc). However, if we pass a second param (extending an
  // existing schema) we do! So, we should find a way to validate that we don't
  // shadow builtins.
  return asDiagnostics(doc, validateSDL);
}

function specSchemaValidation(
  schema: GraphQLSchema,
): DiagnosticsWithoutLocationResult<GraphQLSchema> {
  return asDiagnostics(schema, validateSchema);
}

// Utility to map GraphQL validation errors to a Result of
function asDiagnostics<T>(
  value: T,
  validate: (value: T) => ReadonlyArray<GraphQLError>,
): DiagnosticsWithoutLocationResult<T> {
  const validationErrors = validate(value).filter(
    // FIXME: Handle case where query is not defined (no location)
    (e) => e.source && e.locations && e.positions,
  );
  if (validationErrors.length > 0) {
    return err(validationErrors.map(graphQlErrorToDiagnostic));
  }
  return ok(value);
}

// Given a list of snapshots, merge them into a single snapshot.
function combineSnapshots(snapshots: ExtractionSnapshot[]): ExtractionSnapshot {
  const result: ExtractionSnapshot = {
    definitions: [],
    nameDefinitions: new Map(),
    implicitNameDefinitions: new Map(),
    unresolvedNames: new Map(),
    typesWithTypename: new Set(),
    interfaceDeclarations: [],
  };

  for (const snapshot of snapshots) {
    for (const definition of snapshot.definitions) {
      result.definitions.push(definition);
    }

    for (const [declLoc, entry] of snapshot.nameDefinitions) {
      result.nameDefinitions.set(declLoc, entry);
    }

    for (const [id, reference] of snapshot.unresolvedNames) {
      result.unresolvedNames.set(id, reference);
    }

    for (const [definition, reference] of snapshot.implicitNameDefinitions) {
      result.implicitNameDefinitions.set(definition, reference);
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
