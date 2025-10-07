import type { GratsConfig } from "grats/src/TGratsConfig";

export type OutputOption =
  | "sdl"
  | "typescript"
  | "resolverSignatures"
  | "tsClientEnums"
  | "resolverMap";

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
  // Only serialize non-default config values to keep URLs minimal
  config: Partial<GratsConfig>;
  view: {
    outputOption:
      | "sdl"
      | "typescript"
      | "resolverSignatures"
      | "tsClientEnums"
      | "resolverMap";
  };
  VERSION: number;
};

// Get default config values for all GratsConfig options
// These defaults match the spec in configSpecRaw.json
export function getDefaultPlaygroundConfig(): GratsConfig {
  return {
    graphqlSchema: "./schema.graphql",
    tsSchema: "./schema.ts",
    tsClientEnums: null,
    nullableByDefault: true,
    strictSemanticNullability: false,
    reportTypeScriptTypeErrors: false,
    schemaHeader: "",
    tsSchemaHeader: "",
    tsClientEnumsHeader: "",
    importModuleSpecifierEnding: "",
    EXPERIMENTAL__emitMetadata: false,
    EXPERIMENTAL__emitResolverMap: false,
  };
}

// Serialize state, only including non-default config values
export function getSerializabelState(state: State): SerializableState {
  const defaults = getDefaultPlaygroundConfig();
  const config: Partial<GratsConfig> = {};

  // Only include config values that differ from defaults
  for (const key in state.config) {
    if (state.config[key] !== defaults[key]) {
      config[key] = state.config[key];
    }
  }

  return {
    doc: state.doc,
    config,
    view: state.view,
    VERSION: state.VERSION,
  };
}
