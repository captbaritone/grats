import {
  buildASTSchema,
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
  diagnosticAtGraphQLLocation,
  diagnosticAtTsNode,
  relatedInfoAtTsNode,
} from "./utils/DiagnosticError";
import * as ts from "typescript";
import { ExtractionSnapshot, Extractor } from "./Extractor";
import { GratsDefinitionNode, TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { DIRECTIVES_AST } from "./metadataDirectives";
import { extend } from "./utils/helpers";
import { ParsedCommandLineGrats } from "./gratsConfig";
import * as E from "./Errors";

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
  const checker = program.getTypeChecker();

  const snapshots: ExtractionSnapshot[] = [];

  const errors: ts.Diagnostic[] = [];
  for (const sourceFile of program.getSourceFiles()) {
    // If the file doesn't contain any GraphQL definitions, skip it.
    if (!/@gql/i.test(sourceFile.text)) {
      continue;
    }

    if (options.raw.grats.reportTypeScriptTypeErrors) {
      // If the user asked for us to report TypeScript errors, then we'll report them.
      const typeErrors = ts.getPreEmitDiagnostics(program, sourceFile);
      if (typeErrors.length > 0) {
        extend(errors, typeErrors);
        continue;
      }
    } else {
      // Otherwise, we will only report syntax errors, since they will prevent us from
      // extracting any GraphQL definitions.
      const syntaxErrors = program.getSyntacticDiagnostics(sourceFile);
      if (syntaxErrors.length > 0) {
        // It's not very helpful to report multiple syntax errors, so just report
        // the first one.
        errors.push(syntaxErrors[0]);
        continue;
      }
    }

    const extractor = new Extractor(checker, options.raw.grats);
    const extractedResult = extractor.extract(sourceFile);
    if (extractedResult.kind === "ERROR") {
      extend(errors, extractedResult.err);
      continue;
    }

    snapshots.push(extractedResult.value);
  }

  const ctx = new TypeContext(options, checker, host);
  const definitions: GratsDefinitionNode[] = Array.from(
    DIRECTIVES_AST.definitions,
  );

  {
    // TODO: Extract this block

    const contextReferences: ts.Node[] = [];
    const interfaceDeclarationNodes: ts.InterfaceDeclaration[] = [];

    for (const snapshot of snapshots) {
      // Propagate snapshot data to type context
      for (const [node, typeName] of snapshot.unresolvedNames) {
        ctx.markUnresolvedType(node, typeName);
      }

      for (const [node, definition] of snapshot.nameDefinitions) {
        ctx.recordTypeName(node, definition.name, definition.kind);
      }

      for (const contextReference of snapshot.contextReferences) {
        contextReferences.push(contextReference);
      }

      for (const typeName of snapshot.typesWithTypenameField) {
        ctx.hasTypename.add(typeName);
      }

      // Record extracted GraphQL definitions
      for (const definition of snapshot.definitions) {
        definitions.push(definition);
      }

      for (const interfaceDeclaration of snapshot.interfaceDeclarationNodes) {
        interfaceDeclarationNodes.push(interfaceDeclaration);
      }
    }

    extend(
      errors,
      validateInterfaceDeclarations(checker, interfaceDeclarationNodes),
    );

    const validationError = validateContextReferences(ctx, contextReferences);
    if (validationError != null) {
      errors.push(validationError);
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

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

  const typenameDiagnostics = validateTypename(schema, ctx);
  if (typenameDiagnostics.length > 0) return err(typenameDiagnostics);

  return ok(schema);
}

function validateTypename(
  schema: GraphQLSchema,
  ctx: TypeContext,
): ts.Diagnostic[] {
  const typenameDiagnostics: ts.Diagnostic[] = [];
  const abstractTypes = Object.values(schema.getTypeMap()).filter(
    isAbstractType,
  );
  for (const type of abstractTypes) {
    // TODO: If we already implement resolveType, we don't need to check implementors

    const typeImplementors = schema.getPossibleTypes(type).filter(isType);
    for (const implementor of typeImplementors) {
      if (!ctx.hasTypename.has(implementor.name)) {
        const loc = implementor.astNode?.name?.loc;
        if (loc == null) {
          throw new Error(
            `Grats expected the parsed type \`${implementor.name}\` to have location information. This is a bug in Grats. Please report it.`,
          );
        }
        typenameDiagnostics.push(
          diagnosticAtGraphQLLocation(
            `Missing __typename on \`${implementor.name}\`. The type \`${type.name}\` is used in a union or interface, so it must have a \`__typename\` field.`,
            loc,
          ),
        );
      }
    }
  }
  return typenameDiagnostics;
}

/**
 * Ensure that all context type references resolve to the same
 * type declaration.
 */
function validateContextReferences(
  ctx: TypeContext,
  references: ts.Node[],
): ts.Diagnostic | null {
  let gqlContext: { declaration: ts.Node; firstReference: ts.Node } | null =
    null;
  for (const typeName of references) {
    const symbol = ctx.checker.getSymbolAtLocation(typeName);
    if (symbol == null) {
      return diagnosticAtTsNode(
        typeName,
        E.expectedTypeAnnotationOnContextToBeResolvable(),
      );
    }

    const declaration = ctx.findSymbolDeclaration(symbol);
    if (declaration == null) {
      return diagnosticAtTsNode(
        typeName,
        E.expectedTypeAnnotationOnContextToHaveDeclaration(),
      );
    }

    if (gqlContext == null) {
      // This is the first typed context value we've seen...
      gqlContext = {
        declaration: declaration,
        firstReference: typeName,
      };
    } else if (gqlContext.declaration !== declaration) {
      return diagnosticAtTsNode(typeName, E.multipleContextTypes(), [
        relatedInfoAtTsNode(
          gqlContext.firstReference,
          "A different type reference was used here",
        ),
      ]);
    }
  }
  return null;
}

// Prevent using merged interfaces as GraphQL interfaces.
// https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces
function validateInterfaceDeclarations(
  checker: ts.TypeChecker,
  interfaces: ts.InterfaceDeclaration[],
): ts.Diagnostic[] {
  const errors: ts.Diagnostic[] = [];

  for (const node of interfaces) {
    const symbol = checker.getSymbolAtLocation(node.name);
    if (
      symbol != null &&
      symbol.declarations != null &&
      symbol.declarations.length > 1
    ) {
      const otherLocations = symbol.declarations
        .filter((d) => d !== node && ts.isInterfaceDeclaration(d))
        .map((d) => {
          const locNode = ts.getNameOfDeclaration(d) ?? d;
          return relatedInfoAtTsNode(locNode, "Other declaration");
        });

      if (otherLocations.length > 0) {
        errors.push(
          diagnosticAtTsNode(node.name, E.mergedInterfaces(), otherLocations),
        );
      }
    }
  }

  return errors;
}
