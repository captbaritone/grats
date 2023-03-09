import { buildASTSchema, DefinitionNode, GraphQLSchema, Kind } from "graphql";
import * as fs from "fs/promises";
import { glob } from "glob";
import { validateSDL } from "graphql/validation/validate";
import { graphQlErrorToDiagnostic } from "./utils/DiagnosticError";
import { parseForESLint } from "@typescript-eslint/parser";
import { traverse } from "./Traverse";

// Construct a schema, using GraphQL schema language
export async function buildSchema(pattern: string): Promise<GraphQLSchema> {
  const files = await glob(pattern);

  const typeDefinitions = (
    await Promise.all(files.map(definitionsFromFile))
  ).flat();

  const doc = { kind: Kind.DOCUMENT, definitions: typeDefinitions } as const;
  const validationErrors = validateSDL(doc);
  if (validationErrors.length > 0) {
    // TODO: Report all errors
    const diagnostic = graphQlErrorToDiagnostic(validationErrors[0]);
    throw diagnostic;
  }

  return buildASTSchema(doc, { assumeValidSDL: true });
}

async function definitionsFromFile(
  filePath: string,
): Promise<ReadonlyArray<DefinitionNode>> {
  const code = await fs.readFile(filePath, "utf8");
  // TODO: Handle parse errors.
  // We use parseForESLint because it provides a scope manager
  // which we hope will be useful for resolving types.
  const { ast, scopeManager, services } = parseForESLint(code, {
    comment: true,
    loc: true,
    // Omitting this breaks the scope manager
    range: true,
  });

  return traverse(ast, code, scopeManager, services);
}
