import { DEFAULT_STATE } from "./defaultState";
import { State, SerializableState } from "./store";
import lzstring from "lz-string";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

export function stateFromUrl(): State {
  if (!ExecutionEnvironment.canUseDOM) {
    return DEFAULT_STATE;
  }
  const hash = window.location.hash;
  if (!hash) return DEFAULT_STATE;

  try {
    const state = JSON.parse(
      lzstring.decompressFromEncodedURIComponent(hash.slice(1)),
    );
    if (state.VERSION === 1) {
      return {
        ...DEFAULT_STATE,
        ...state,
        config: {
          ...DEFAULT_STATE.config,
          ...state.config,
        },
        view: {
          ...DEFAULT_STATE.view,
          ...state.view,
        },
      };
    }
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_STATE;
}

export function serializeState(serializableState: SerializableState): string {
  const hash = lzstring.compressToEncodedURIComponent(
    JSON.stringify(serializableState),
  );
  return hash;
}
