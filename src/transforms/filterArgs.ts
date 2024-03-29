import { DefinitionNode, Kind, visit } from "graphql";
import { TypeContext } from "../TypeContext";
import { innerType, invariant } from "../utils/helpers";
import { ResolverArg } from "../IR";
import { FieldDefinitionNode } from "graphql/language";

/**
 * Replace check each positional argument and test if it's a context or info
 * type. If it is, it's not a GraphQL argument, so we should remove it from the
 * field's list of arguments and transom the field's signature metadata.
 */
export function filterArgs(
  ctx: TypeContext,
  definitions: DefinitionNode[],
): DefinitionNode[] {
  return definitions.map((def) => {
    return visit(def, {
      [Kind.FIELD_DEFINITION]: (node) => handField(ctx, node),
    });
  });
}

function handField(ctx: TypeContext, node: FieldDefinitionNode) {
  if (node.arguments == null) {
    return node;
  }
  let tsArgs = node.resolverSignature.args;

  // A .filter() with side effects inside. I'm a monster.
  const args = node.arguments.filter((arg) => {
    const typeName = innerType(arg.type);
    if (typeName.name.value !== "__UNRESOLVED_REFERENCE__") {
      // Primitive types are not context args
      return true;
    }
    const namedTypeResult = ctx.gqlNameDefinitionForGqlName(typeName.name);
    if (namedTypeResult.kind === "ERROR") {
      // This will get reported later in the pipeline
      return true;
    }
    if (namedTypeResult.value.kind === "CONTEXT") {
      // Need to mark the field as using the context
      tsArgs = replaceResolverArg(tsArgs, arg.name.value, { kind: "context" });
      // TODO: Assert non-plural
      return false;
    }
    if (namedTypeResult.value.kind === "INFO") {
      // Need to mark the field as using the context
      tsArgs = replaceResolverArg(tsArgs, arg.name.value, { kind: "info" });
      // TODO: Assert non-plural
      return false;
    }
    return true;
  });

  if (args.length === node.arguments.length) {
    invariant(
      tsArgs === node.resolverSignature.args,
      "Should not have changed",
    );
    return node;
  }

  return {
    ...node,
    arguments: args,
    resolverSignature: { ...node.resolverSignature, args: tsArgs },
  };
}

function replaceResolverArg(
  tsArgs: null | readonly ResolverArg[],
  name: string,
  newArg: ResolverArg,
): null | readonly ResolverArg[] {
  if (tsArgs == null) return null;
  return tsArgs.map((tsArg) => {
    if (tsArg.kind === "positionalArg" && tsArg.name === name) {
      return newArg;
    }
    return tsArg;
  });
}
