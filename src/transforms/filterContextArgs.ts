import { DefinitionNode, Kind, visit } from "graphql";
import { TypeContext } from "../TypeContext";
import { ContextNodeType } from "../Extractor";
import { innerType, nullThrows } from "../utils/helpers";

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
        let contextArgIndex: number | null = null;
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
            contextArgIndex = nullThrows(arg.argIndex);
            if (tsArgs != null) {
              tsArgs = tsArgs.map((tsArg) => {
                if (
                  tsArg.kind === "positionalArg" &&
                  tsArg.name === arg.name.value
                ) {
                  return { kind: "context" };
                }
                return tsArg;
              });
            }

            // TODO: Assert non-plural
            return false;
          }
        });

        if (contextArgIndex == null) {
          return node;
        }

        return {
          ...node,
          arguments: args,
          contextArgIndex,
          resolverSignature: {
            ...node.resolverSignature,
            args: tsArgs,
          },
        };
      },
    });
  });
}
