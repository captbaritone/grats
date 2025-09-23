import { ResolverSignature } from "./resolverSignature";

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
    hasTypeNameField: boolean;
    exported?: {
      tsModulePath: string;
      exportName: string | null;
    };
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
     * Grats metadata: Describes the backing resolver for a field. Eventually
     * this gets transformed into a @resolver directive. However, we delay doing
     * that to avoid repeated parsing, and to allow for unresolved types early
     * on during compilation.
     */
    resolver?: ResolverSignature;
    killsParentOnException?: NameNode;
  }

  export interface DirectiveNode {
    /**
     * Grats metadata: Indicates that the directive was added by Grats
     */
    isAmbiguous?: boolean;
  }

  export interface ConstDirectiveNode {
    /**
     * Grats metadata: Indicates that the directive was added by Grats
     */
    isAmbiguous?: boolean;
  }

  export interface EnumValueDefinitionNode {
    /**
     * Grats metadata: The TypeScript name of the enum value.
     */
    tsName?: string;
  }

  export interface ScalarTypeDefinitionNode {
    /**
     * Grats metadata: The module path and export name of the scalar implementation.
     * If null, the scalar is either a built-in scalar or a custom scalar that
     * is not exported from a module.
     */
    exported?: {
      tsModulePath: string;
      exportName: string;
    } | null;
  }
}
