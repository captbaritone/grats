import {
  ConstDirectiveNode,
  DefinitionNode,
  DocumentNode,
  Kind,
  Location,
  parse,
} from "graphql";
import { uniqueId } from "./utils/helpers";

/**
 * In most cases we can use directives to annotate constructs
 * however, it't not possible to annotate an individual TypeNode.
 * Additionally, we can't use sets or maps to "tag" nodes because
 * there are places where we immutably update the AST to make changes.
 *
 * Instead, we cheat and add properties to some nodes. These types use
 * interface merging to add our own properties to the AST.
 *
 * We try to use this approach sparingly.
 */
declare module "graphql" {
  export interface ListTypeNode {
    /**
     * Grats metadata: Whether the list type was defined as an AsyncIterable.
     * Used to ensure that all fields on `Subscription` return an AsyncIterable.
     */
    isAsyncIterable?: boolean;
  }
  export interface NameNode {
    /**
     * Grats metadata: A unique identifier for the node. Used to track
     * data about nodes in lookup data structures.
     */
    tsIdentifier: number;
  }
  export interface ObjectTypeDefinitionNode {
    /**
     * Grats metadata: Indicates that the type was materialized as part of
     * generic type resolution.
     */
    wasSynthesized?: boolean;
  }
  export interface UnionTypeDefinitionNode {
    /**
     * Grats metadata: Indicates that the type was materialized as part of
     * generic type resolution.
     */
    wasSynthesized?: boolean;
  }
  export interface InterfaceTypeDefinitionNode {
    /**
     * Grats metadata: Indicates that the type was materialized as part of
     * generic type resolution.
     */
    wasSynthesized?: boolean;
  }
  export interface ObjectTypeExtensionNode {
    /**
     * Grats metadata: Indicates that we don't know yet if this is extending an interface
     * or a type.
     */
    mayBeInterface?: boolean;
  }

  export interface InputValueDefinitionNode {
    /**
     * Grats metadata: If this was a positional argument, this is the index of the argument.
     */
    argIndex?: number;
  }

  export interface FieldDefinitionNode {
    /**
     * Grats metadata: If this field is a function, this is the metadata for the field.
     */
    contextArgIndex?: number;
    /**
     * Grats metadata: Encodes how the resolver function was defined such that we know how to call it in codegen.
     */
    resolverSignature: ResolverSignature;
  }
}

export type ResolverArg =
  | {
      kind: "context";
    }
  | {
      kind: "info";
    }
  | {
      kind: "source";
    }
  | {
      kind: "argsObj";
    }
  | {
      kind: "positionalArg";
      name: string;
    };

export type ResolverSignature =
  | {
      kind: "property";
      name: string | null;
      args: readonly ResolverArg[] | null;
    }
  | {
      kind: "function";
      exportName: string | null;
      tsModulePath: string;
      methodName: string | null;
      args: readonly ResolverArg[];
    };

export const KILLS_PARENT_ON_EXCEPTION_DIRECTIVE = "killsParentOnException";

export const METADATA_DIRECTIVE_NAMES = new Set([
  KILLS_PARENT_ON_EXCEPTION_DIRECTIVE,
]);

export const DIRECTIVES_AST: DocumentNode = parse(`
    directive @${KILLS_PARENT_ON_EXCEPTION_DIRECTIVE} on FIELD_DEFINITION
`);

export function addMetadataDirectives(
  definitions: Array<DefinitionNode>,
): Array<DefinitionNode> {
  return [...DIRECTIVES_AST.definitions, ...definitions];
}

export function makeKillsParentOnExceptionDirective(
  loc: Location,
): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    loc,
    name: {
      kind: Kind.NAME,
      loc,
      value: KILLS_PARENT_ON_EXCEPTION_DIRECTIVE,
      tsIdentifier: uniqueId(),
    },
    arguments: [],
  };
}
