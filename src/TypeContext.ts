import { NameNode } from "graphql";
import { ResolverArgument } from "./resolverSignature.js";

/**
 * The types of the definitions `TypeContext` maps declarations to. The
 * `TypeContext` itself has been ported to Rust. See
 * `grats-rs/crates/grats/src/type_context.rs`.
 */

export const UNRESOLVED_REFERENCE_NAME = `__UNRESOLVED_REFERENCE__`;

export type DerivedResolverDefinition = {
  name: NameNode;
  path: string;
  exportName: string | null;
  args: ResolverArgument[];
  kind: "DERIVED_CONTEXT";
  async: boolean;
};

export type NameDefinition = {
  name: NameNode;
  kind:
    | "TYPE"
    | "INTERFACE"
    | "UNION"
    | "SCALAR"
    | "INPUT_OBJECT"
    | "ENUM"
    | "CONTEXT"
    | "INFO";
};

export type DeclarationDefinition = NameDefinition | DerivedResolverDefinition;
