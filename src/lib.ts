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
} from "./utils/DiagnosticError";
import * as ts from "typescript";
import { Extractor } from "./Extractor";
import { GratsDefinitionNode, TypeContext } from "./TypeContext";
import { validateSDL } from "graphql/validation/validate";
import { applyServerDirectives, DIRECTIVES_AST } from "./serverDirectives";
import { extend } from "./utils/helpers";

export { applyServerDirectives } from "./serverDirectives";

export type ConfigOptions = {
  // Should all fields be typed as nullable in accordance with GraphQL best practices?
  // https://graphql.org/learn/best-practices/#nullability
  nullableByDefault?: boolean;

  // Should Grats report TypeScript type errors?
  // Defaults to `false`.
  reportTypeScriptTypeErrors?: boolean;
};

// Construct a schema, using GraphQL schema language
// Exported for tests that want to intercept diagnostic errors.
export function buildSchemaResult(
  options: ts.ParsedCommandLine,
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
  options: ts.ParsedCommandLine,
  compilerHost: ts.CompilerHost,
): Result<GraphQLSchema, ReportableDiagnostics> {
  const gratsOptions: ConfigOptions = parseGratsOptions(options);
  const schemaResult = extractSchema(options, gratsOptions, compilerHost);
  if (schemaResult.kind === "ERROR") {
    return err(new ReportableDiagnostics(compilerHost, schemaResult.err));
  }

  return ok(applyServerDirectives(schemaResult.value));
}

// TODO: Make this return diagnostics
function parseGratsOptions(options: ts.ParsedCommandLine): ConfigOptions {
  const gratsOptions = { ...(options.raw?.grats ?? {}) };
  if (gratsOptions.nullableByDefault === undefined) {
    gratsOptions.nullableByDefault = true;
  } else if (typeof gratsOptions.nullableByDefault !== "boolean") {
    throw new Error(
      "Grats: The Grats config option `nullableByDefault` must be a boolean if provided.",
    );
  }
  if (gratsOptions.reportTypeScriptTypeErrors === undefined) {
    gratsOptions.reportTypeScriptTypeErrors = false;
  } else if (typeof gratsOptions.reportTypeScriptTypeErrors !== "boolean") {
    throw new Error(
      "Grats: The Grats config option `reportTypeScriptTypeErrors` must be a boolean if provided",
    );
  }
  // FIXME: Check for unknown options
  return gratsOptions;
}

function extractSchema(
  options: ts.ParsedCommandLine,
  gratsOptions: ConfigOptions,
  host: ts.CompilerHost,
): DiagnosticsResult<GraphQLSchema> {
  const program = ts.createProgram(options.fileNames, options.options, host);
  const checker = program.getTypeChecker();
  const ctx = new TypeContext(options, checker, host);

  const definitions: GratsDefinitionNode[] = Array.from(
    DIRECTIVES_AST.definitions,
  );

  const errors: ts.Diagnostic[] = [];
  for (const sourceFile of program.getSourceFiles()) {
    // If the file doesn't contain any GraphQL definitions, skip it.
    if (!/@gql/i.test(sourceFile.text)) {
      continue;
    }

    if (gratsOptions.reportTypeScriptTypeErrors) {
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

    const extractor = new Extractor(sourceFile, ctx, gratsOptions);
    const extractedResult = extractor.extract();
    if (extractedResult.kind === "ERROR") {
      extend(errors, extractedResult.err);
      continue;
    }
    for (const definition of extractedResult.value) {
      definitions.push(definition);
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
