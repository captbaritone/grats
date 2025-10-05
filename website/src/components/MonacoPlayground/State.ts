export type OutputOption = "sdl" | "typescript" | "resolverSignatures";
export type State = {
  doc: string;
  config: {
    nullableByDefault: boolean;
    reportTypeScriptTypeErrors: boolean;
    importModuleSpecifierEnding: string | null;
  };
  view: {
    /** @deprecated */
    showGratsDirectives: boolean;
    outputOption: OutputOption;
  };
  gratsResult: null | {
    graphql: string;
    typescript: string;
    resolverSignatures: string;
  };
  VERSION: number;
};

export type SerializableState = {
  doc: string;
  config: {
    nullableByDefault: boolean;
    reportTypeScriptTypeErrors: boolean;
  };
  view: {
    outputOption: "sdl" | "typescript" | "resolverSignatures";
  };
  VERSION: number;
};

// TODO: Avoid recomputing
export function getSerializabelState(state: State): SerializableState {
  const { gratsResult, ...serializableState } = state;
  return serializableState;
}
