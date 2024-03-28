import { DefinitionNode, Kind, visit } from "graphql";
import { TypeContext } from "../TypeContext";
import { ContextNodeType } from "../Extractor";
import { innerType } from "../utils/helpers";
import { ResolverArg } from "../IR";

export function filterContextArgs(
  ctx: TypeContext,
  definitions: DefinitionNode[],
  contextDef: ContextNodeType | null,
): DefinitionNode[] {
  if (contextDef == null) {
    return definitions;
  }

  return definitions.map((def) => {
    return visit(def, {
      [Kind.FIELD_DEFINITION]: (node) => {
        if (node.arguments == null) {
          return node;
        }
        let tsArgs = node.resolverSignature.args;

        function markAsContext(name: string): null | readonly ResolverArg[] {
          if (tsArgs == null) return null;
          return tsArgs.map((tsArg) => {
            if (tsArg.kind === "positionalArg" && tsArg.name === name) {
              return { kind: "context" };
            }
            return tsArg;
          });
        }

        const args = node.arguments.filter((arg) => {
          const typeName = innerType(arg.type);
          if (typeName.name.value !== "__UNRESOLVED_REFERENCE__") {
            // Primitive types are not context args
            return true;
          }
          const namedTypeResult = ctx.gqlNameDefinitionForGqlName(
            typeName.name,
          );
          if (namedTypeResult.kind === "ERROR") {
            // This will get reported later in the pipeline
            return true;
          }
          if (namedTypeResult.value.kind === "CONTEXT") {
            // Need to mark the field as using the context
            tsArgs = markAsContext(arg.name.value);
            // TODO: Assert non-plural
            return false;
          }
        });

        return {
          ...node,
          arguments: args,
          resolverSignature: {
            ...node.resolverSignature,
            args: tsArgs,
          },
        };
      },
    });
  });
}
