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
 * Describes the backing resolver for a field. This broadly matches the
 * `@resolver` directive but has some additional information used internally by
 * Grats such as a variant for unresolved arguments, which get resolved as part
 * of the compilation process, and TypeScript AST nodes for tracking the original sources.
 */
export type Resolver =
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
