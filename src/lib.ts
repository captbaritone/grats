import {
  buildASTSchema,
  DocumentNode,
  GraphQLSchema,
  isAbstractType,
  isType,
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
  gqlErr,
  combineResults,
  collectResults,
} from "./utils/DiagnosticError";
import * as ts from "typescript";
import { ExtractionSnapshot, extract } from "./Extractor";
import { GratsDefinitionNode, TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { DIRECTIVES_AST } from "./metadataDirectives";
import { extend } from "./utils/helpers";
import { ParsedCommandLineGrats } from "./gratsConfig";

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

  const errors: ts.Diagnostic[] = [];
  const gratsSourceFiles = program.getSourceFiles().filter((sourceFile) => {
    // If the file doesn't contain any GraphQL definitions, skip it.
    if (!/@gql/i.test(sourceFile.text)) {
      return false;
    }

    if (options.raw.grats.reportTypeScriptTypeErrors) {
      // If the user asked for us to report TypeScript errors, then we'll report them.
      const typeErrors = ts.getPreEmitDiagnostics(program, sourceFile);
      if (typeErrors.length > 0) {
        extend(errors, typeErrors);
        return false;
      }
    } else {
      // Otherwise, we will only report syntax errors, since they will prevent us from
      // extracting any GraphQL definitions.
      const syntaxErrors = program.getSyntacticDiagnostics(sourceFile);
      if (syntaxErrors.length > 0) {
        // It's not very helpful to report multiple syntax errors, so just report
        // the first one.
        errors.push(syntaxErrors[0]);
        return false;
      }
    }
    return true;
  });

  const extractResults = gratsSourceFiles.map((sourceFile) => {
    return extract(options.raw.grats, sourceFile);
  });

  const snapshotResults = collectResults(extractResults);
  if (snapshotResults.kind === "ERROR") {
    extend(errors, snapshotResults.err);
    return err(errors); // Needed to satisfy type checker
  }

  if (errors.length > 0) {
    return err(errors);
  }

  const snapshot = reduceSnapshots(snapshotResults.value);

  const checker = program.getTypeChecker();

  const docResult = docFromSnapshot(options, checker, host, snapshot);

  if (docResult.kind === "ERROR") {
    return err(docResult.err);
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
  const schema = buildASTSchema(doc, { assumeValidSDL: true });

  const diagnostics = validateSchema(schema)
    // FIXME: Handle case where query is not defined (no location)
    .filter((e) => e.source && e.locations && e.positions)
    .map((e) => graphQlErrorToDiagnostic(e));

  if (diagnostics.length > 0) {
    return err(diagnostics);
  }

  const typenameDiagnostics = validateTypename(
    schema,
    snapshot.typesWithTypenameField,
  );
  if (typenameDiagnostics.length > 0) return err(typenameDiagnostics);

  return ok(schema);
}

function validateTypename(
  schema: GraphQLSchema,
  hasTypename: Set<string>,
): ts.Diagnostic[] {
  const typenameDiagnostics: ts.Diagnostic[] = [];
  const abstractTypes = Object.values(schema.getTypeMap()).filter(
    isAbstractType,
  );
  for (const type of abstractTypes) {
    // TODO: If we already implement resolveType, we don't need to check implementors

    const typeImplementors = schema.getPossibleTypes(type).filter(isType);
    for (const implementor of typeImplementors) {
      if (!hasTypename.has(implementor.name)) {
        const loc = implementor.astNode?.name?.loc;
        if (loc == null) {
          throw new Error(
            `Grats expected the parsed type \`${implementor.name}\` to have location information. This is a bug in Grats. Please report it.`,
          );
        }
        typenameDiagnostics.push(
          gqlErr(
            loc,
            `Missing __typename on \`${implementor.name}\`. The type \`${type.name}\` is used in a union or interface, so it must have a \`__typename\` field.`,
          ),
        );
      }
    }
  }
  return typenameDiagnostics;
}

export function docFromSnapshot(
  options: ts.ParsedCommandLine,
  checker: ts.TypeChecker,
  host: ts.CompilerHost,
  snapshot: ExtractionSnapshot,
): DiagnosticsResult<DocumentNode> {
  const ctx = new TypeContext(options, checker, host);

  // Phase 1: Validate the snapshot
  const mergedResult = combineResults(
    ctx.validateMergedInterfaces(snapshot.interfaceDeclarations),
    ctx.validateContextReferences(snapshot.contextReferences),
  );
  if (mergedResult.kind === "ERROR") {
    return mergedResult;
  }

  // Phase 2: Propagate snapshot data to type context

  for (const [node, typeName] of snapshot.unresolvedNames) {
    ctx.markUnresolvedType(node, typeName);
  }

  for (const [node, definition] of snapshot.nameDefinitions) {
    ctx.recordTypeName(node, definition.name, definition.kind);
  }

  // Phase 3: Fixup the schema SDL

  const definitions: GratsDefinitionNode[] = Array.from(
    DIRECTIVES_AST.definitions,
  );

  extend(definitions, snapshot.definitions);

  // If you define a field on an interface using the functional style, we need to add
  // that field to each concrete type as well. This must be done after all types are created,
  // but before we validate the schema.
  const definitionsResult = ctx.handleAbstractDefinitions(definitions);
  if (definitionsResult.kind === "ERROR") {
    return definitionsResult;
  }

  const docResult = ctx.resolveTypes({
    kind: Kind.DOCUMENT,
    definitions: definitionsResult.value,
  });
  if (docResult.kind === "ERROR") return docResult;

  const doc = docResult.value;

  const subscriptionsValidationResult = ctx.validateAsyncIterableFields(doc);
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
