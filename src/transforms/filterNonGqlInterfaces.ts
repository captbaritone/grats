import type { DefinitionNode, NamedTypeNode } from "graphql";
import { Kind } from "graphql";
import type { TypeContext } from "../TypeContext.ts";

type InterfaceHaver = {
  readonly interfaces?: ReadonlyArray<NamedTypeNode>;
};

/**
 * Filter out `implements` declarations that don't refer to a GraphQL interface.
 * Note: We depend upon traversal order here to ensure that we remove all
 * non-GraphQL interfaces before we try to resolve the names of the GraphQL
 * interfaces.
 */
export function filterNonGqlInterfaces(
  ctx: TypeContext,
  definitions: DefinitionNode[],
): DefinitionNode[] {
  return definitions.map((def) => {
    if (
      def.kind === Kind.INTERFACE_TYPE_DEFINITION ||
      def.kind === Kind.INTERFACE_TYPE_EXTENSION ||
      def.kind === Kind.OBJECT_TYPE_DEFINITION ||
      def.kind === Kind.OBJECT_TYPE_EXTENSION
    ) {
      return filterInterfaces(ctx, def);
    }
    return def;
  });
}

function filterInterfaces<T extends InterfaceHaver>(ctx: TypeContext, t: T): T {
  if (t.interfaces == null || t.interfaces.length === 0) {
    return t;
  }
  const gqlInterfaces = t.interfaces.filter((i) => {
    return ctx.unresolvedNameIsGraphQL(i.name);
  });
  if (t.interfaces.length === gqlInterfaces.length) {
    return t;
  }
  return { ...t, interfaces: gqlInterfaces };
}
