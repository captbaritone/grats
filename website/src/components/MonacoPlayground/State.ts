import type { GratsConfig } from "../configSchema";

export type OutputOption =
  | "sdl"
  | "typescript"
  | "resolverSignatures"
  | "tsClientEnums"
  | "resolverMap";

/**
 * The side of the playground shown: the server, where the code defines the
 * schema, or the client, where GraphiQL queries it.
 */
export type Side = "server" | "client";

export type State = {
  doc: string;
  config: GratsConfig;
  view: {
    /** @deprecated */
    showGratsDirectives: boolean;
    outputOption: OutputOption;
  };

  VERSION: number;
};

export type SerializableState = {
  doc: string;
  // The `grats` key of the playground's tsconfig.json.
  config: { [option: string]: unknown };
  view: {
    outputOption: OutputOption;
  };
  VERSION: number;
};

// Every option, as older playground URLs hold them: Grats' defaults (see
// grats-rs/crates/grats/grats-config-schema.json), but without headers.
export function getDefaultPlaygroundConfig(): GratsConfig {
  return {
    graphqlSchema: "./schema.graphql",
    tsSchema: "./schema.ts",
    tsClientEnums: null,
    nullableByDefault: true,
    strictSemanticNullability: false,
    schemaHeader: "",
    tsSchemaHeader: "",
    tsClientEnumsHeader: "",
    importModuleSpecifierEnding: "",
    EXPERIMENTAL__emitMetadata: false,
    EXPERIMENTAL__emitResolverMap: false,
  };
}
