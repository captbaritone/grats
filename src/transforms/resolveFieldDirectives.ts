import { DefinitionNode, Kind } from "graphql";
import * as ts from "typescript";
import { relativePath } from "../gratsRoot.js";
import { LIBRARY_IMPORT_NAME } from "../Extractor.js";
import { TypeContext } from "../TypeContext.js";

const FIELD_DIRECTIVE_TYPE_NAME = "FieldDirective";

/**
 * After extraction, directive definitions have a reference to their TS function
 * declaration but we don't yet know if they return `FieldDirective`. This
 * transform uses the TypeContext to resolve the return type and, when it points
 * to grats' `FieldDirective`, records the export information needed for codegen
 * to wrap field resolvers.
 */
export function resolveFieldDirectives(
  ctx: TypeContext,
  definitions: DefinitionNode[],
): DefinitionNode[] {
  for (const def of definitions) {
    if (def.kind !== Kind.DIRECTIVE_DEFINITION) continue;
    const node = def.tsFunctionDeclaration;
    if (node == null) continue;

    if (returnsFieldDirective(ctx, node)) {
      const tsModulePath = relativePath(node.getSourceFile().fileName);
      def.exported = {
        tsModulePath,
        exportName: node.name?.text ?? null,
      };
    }

    // Clean up the TS node reference — it's no longer needed after this
    // transform and shouldn't leak into later stages.
    delete def.tsFunctionDeclaration;
  }
  return definitions;
}

/**
 * Check if a function declaration's return type resolves to grats'
 * `FieldDirective` type by following type references through the TypeContext.
 */
function returnsFieldDirective(
  ctx: TypeContext,
  node: ts.FunctionDeclaration,
): boolean {
  const returnTypeNode = node.type;
  if (returnTypeNode == null) return false;
  if (!ts.isTypeReferenceNode(returnTypeNode)) return false;

  const decl = ctx.resolveNodeDeclaration(returnTypeNode.typeName);
  if (decl == null) return false;
  if (!ts.isTypeAliasDeclaration(decl)) return false;
  if (decl.name.text !== FIELD_DIRECTIVE_TYPE_NAME) return false;

  // Check if this declaration is from the grats module's Types file.
  // Matches both node_modules/grats/... and local source paths.
  const sourceFile = decl.getSourceFile().fileName;
  return (
    sourceFile.includes(`/${LIBRARY_IMPORT_NAME}/src/Types`) ||
    sourceFile.includes(`/${LIBRARY_IMPORT_NAME}/dist/src/Types`)
  );
}
