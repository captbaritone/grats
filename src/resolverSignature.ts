import * as ts from "typescript";
import {
  ConstDirectiveNode,
  ConstValueNode,
  InputValueDefinitionNode,
  Kind,
  Location,
  NameNode,
  StringValueNode,
  TypeNode,
} from "graphql";
import { DiagnosticResult } from "./utils/DiagnosticError";

/**
 * Describes the backing resolver for a field. This broadly matches the metadata
 * shape that is part of the public API of Grats, but also includes location
 * information as well as information about resolver with types which have not
 * yet been resolved.
 */
export type ResolverSignature =
  | {
      kind: "property";
      name: string | null;
      node: ts.Node;
    }
  | {
      kind: "method";
      name: string | null;
      arguments: ResolverArgument[] | null;
      node: ts.Node;
    }
  | {
      kind: "function";
      path: string;
      exportName: string | null;
      arguments: ResolverArgument[] | null;
      node: ts.Node;
    }
  | {
      kind: "staticMethod";
      path: string;
      exportName: string | null;
      name: string;
      arguments: ResolverArgument[] | null;
      node: ts.Node;
    };

export type SourceResolverArgument = {
  kind: "source";
  node: ts.Node;
};

export type ArgumentsObjectResolverArgument = {
  kind: "argumentsObject";
  node: ts.Node;
};

export type ContextResolverArgument = {
  kind: "context";
  node: ts.Node;
};

export type DerivedContextResolverArgument = {
  kind: "derivedContext";
  path: string;
  exportName: string | null;
  args: Array<DerivedContextResolverArgument | ContextResolverArgument>;
  node: ts.Node;
  async: boolean;
};

export type InformationResolverArgument = {
  kind: "information";
  node: ts.Node;
};

export type NamedResolverArgument = {
  kind: "named";
  name: string;
  node: ts.Node;
  inputDefinition: InputValueDefinitionNode;
};

export type UnresolvedResolverArgument = {
  kind: "unresolved";
  inputDefinition: InputValueDefinitionNodeOrResolverArg;
  node: ts.Node;
};

export type ResolverArgument =
  | SourceResolverArgument
  | ArgumentsObjectResolverArgument
  | ContextResolverArgument
  | DerivedContextResolverArgument
  | InformationResolverArgument
  | NamedResolverArgument
  | UnresolvedResolverArgument;

/**
 * At extraction time we don't know if a resolver arg is context, info, or a
 * positional GraphQL argument. If it's a positional argument, we need to ensure
 * it has a valid name. If it's just info or context, it's fine if it doesn't
 * have a name e.g. (destructured).
 */
export interface InputValueDefinitionNodeOrResolverArg {
  readonly kind: Kind.INPUT_VALUE_DEFINITION;
  readonly loc: Location;
  readonly description?: StringValueNode;
  // This is the only property that is different.
  readonly name: DiagnosticResult<NameNode>;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}
