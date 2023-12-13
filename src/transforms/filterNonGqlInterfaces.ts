import { DocumentNode, Kind, NamedTypeNode, visit } from "graphql";
import { TypeContext } from "../TypeContext";

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
  doc: DocumentNode,
): DocumentNode {
  return visit(doc, {
    [Kind.INTERFACE_TYPE_DEFINITION]: (t) => filterInterfaces(ctx, t),
    [Kind.OBJECT_TYPE_DEFINITION]: (t) => filterInterfaces(ctx, t),
    [Kind.OBJECT_TYPE_EXTENSION]: (t) => filterInterfaces(ctx, t),
    [Kind.INTERFACE_TYPE_EXTENSION]: (t) => filterInterfaces(ctx, t),
  });
}

function filterInterfaces(ctx: TypeContext, t: InterfaceHaver): InterfaceHaver {
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
