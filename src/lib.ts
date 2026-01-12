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
} from "./utils/DiagnosticError";
import { concatResults, ResultPipe } from "./utils/Result";
import { ok, err } from "./utils/Result";
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
import { Metadata } from "./metadata";
import { validateDirectiveArguments } from "./validations/validateDirectiveArguments";
import { coerceDefaultEnumValues } from "./transforms/coerceDefaultEnumValues";
import { validateSomeTypesAreDefined } from "./validations/validateSomeTypesAreDefined";

// Export the TypeScript plugin implementation used by
// grats-ts-plugin
export { initTsPlugin } from "./tsPlugin/initTsPlugin";

export type { GratsConfig } from "./gratsConfig";

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
      const checker = program.getTypeChecker();
      const ctxResult = TypeContext.fromSnapshot(checker, snapshot);
      if (ctxResult.kind === "ERROR") {
        return ctxResult;
      }
      const ctx = ctxResult.value;

      // Collect validation errors
      const validationResult = concatResults(
        validateMergedInterfaces(checker, snapshot.interfaceDeclarations),
        validateDuplicateContextOrInfo(snapshot.nameDefinitions.values()),
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
          // Provide a helpful getting started error if no types are detected.
          .andThen((schema) => validateSomeTypesAreDefined(schema))
          // Ensure that any custom validations that are not part of the spec
          // are also applied.
          // The above spec validation fails to catch type errors in directive
          // arguments, so Grats checks these manually.
          .andThen((schema) => validateDirectiveArguments(schema, doc))
          // Ensure that every type which implements an interface or is a member of a
          // union has a __typename field.
          .andThen((schema) => validateTypenames(schema, typesWithTypename))
          // Validate that semantic nullability directives are not in conflict
          // with type nullability.
          .andThen((schema) => validateSemanticNullability(schema, config))
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

    for (const [node, definition] of snapshot.nameDefinitions) {
      result.nameDefinitions.set(node, definition);
    }

    for (const [node, typeName] of snapshot.unresolvedNames) {
      result.unresolvedNames.set(node, typeName);
    }

    for (const [node, definition] of snapshot.implicitNameDefinitions) {
      result.implicitNameDefinitions.set(node, definition);
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
