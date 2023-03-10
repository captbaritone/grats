import { buildASTSchema, DefinitionNode, GraphQLSchema, Kind } from "graphql";
import { glob } from "glob";
import { validateSDL } from "graphql/validation/validate";
import { graphQlErrorToDiagnostic } from "./utils/DiagnosticError";
import * as ts from "typescript";
import { Extractor } from "./Extractor";

// Construct a schema, using GraphQL schema language
export async function buildSchema(pattern: string): Promise<GraphQLSchema> {
  const files = await glob(pattern);

  const typeDefinitions = definitionsFromFile(files);

  const doc = { kind: Kind.DOCUMENT, definitions: typeDefinitions } as const;
  const validationErrors = validateSDL(doc);
  if (validationErrors.length > 0) {
    // TODO: Report all errors
    const diagnostic = graphQlErrorToDiagnostic(validationErrors[0]);
    throw diagnostic;
  }

  return buildASTSchema(doc, { assumeValidSDL: true });
}

function definitionsFromFile(
  filePaths: string[],
): ReadonlyArray<DefinitionNode> {
  // https://stackoverflow.com/a/66604532/1263117
  const options: ts.CompilerOptions = { allowJs: true };
  const compilerHost = ts.createCompilerHost(
    options,
    /* setParentNodes this is needed for finding jsDocs */
    true,
  );
  let program = ts.createProgram(filePaths, options, compilerHost);
  const checker = program.getTypeChecker();

  const allDefinitions: DefinitionNode[] = [];
  for (const filePath of filePaths) {
    const sourceFile = program.getSourceFile(filePath);

    const extractor = new Extractor(sourceFile, checker);
    for (const definition of extractor.extract()) {
      allDefinitions.push(definition);
    }
  }
  return allDefinitions;
}
