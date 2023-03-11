import {
  buildASTSchema,
  DefinitionNode,
  DocumentNode,
  GraphQLSchema,
  Kind,
  visit,
} from "graphql";
import { glob } from "glob";
import { validateSDL } from "graphql/validation/validate";
import { graphQlErrorToDiagnostic } from "./utils/DiagnosticError";
import * as ts from "typescript";
import { Extractor } from "./Extractor";
import { TypeContext } from "./TypeContext";

// Construct a schema, using GraphQL schema language
export async function buildSchema(pattern: string): Promise<GraphQLSchema> {
  const files = await glob(pattern);

  const doc = definitionsFromFile(files);

  const validationErrors = validateSDL(doc);
  if (validationErrors.length > 0) {
    // TODO: Report all errors
    const diagnostic = graphQlErrorToDiagnostic(validationErrors[0]);
    throw diagnostic;
  }

  return buildASTSchema(doc, { assumeValidSDL: true });
}

function definitionsFromFile(filePaths: string[]): DocumentNode {
  // https://stackoverflow.com/a/66604532/1263117
  const options: ts.CompilerOptions = { allowJs: true };
  const compilerHost = ts.createCompilerHost(
    options,
    /* setParentNodes this is needed for finding jsDocs */
    true,
  );
  let program = ts.createProgram(filePaths, options, compilerHost);
  const checker = program.getTypeChecker();
  const ctx = new TypeContext(checker);

  const definitions: DefinitionNode[] = [];
  for (const filePath of filePaths) {
    const sourceFile = program.getSourceFile(filePath);

    const extractor = new Extractor(sourceFile, ctx);
    for (const definition of extractor.extract()) {
      definitions.push(definition);
    }
  }

  return ctx.resolveTypes({ kind: Kind.DOCUMENT, definitions });
}
