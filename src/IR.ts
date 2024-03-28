import { Location } from "graphql";

/**
 * Rather than defining our own internal representation (IR), we simply use
 * graphql-js's AST and then augment it with any additional metadata we need
 * using interface merging, a confusing but occasionally (like here) useful
 * feature of TypeScript.
 *
 * We trust that the graphql-js traversal utility will preserve fields it
 * doesn't know about.
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

  export interface FieldDefinitionNode {
    /**
     * Grats metadata: Indicates that the user has marked this field as non-nullable.
     */
    killsParentOnException?: Location;
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

/**
 * Encodes how to call a resolver that is a property/method on an object
 */
export type PropertyResolver = {
  kind: "property";
  name: string | null;
  args: readonly ResolverArg[] | null;
};

/**
 * Encodes how to call a resolver that is function or public method
 */
export type FunctionResolver = {
  kind: "function";
  exportName: string | null;
  tsModulePath: string;
  methodName: string | null;
  args: readonly ResolverArg[];
};

export type ResolverSignature = PropertyResolver | FunctionResolver;
