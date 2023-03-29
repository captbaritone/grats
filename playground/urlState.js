import { DEFAULT_STATE } from "./defaultState";
import { onSelectorChange, getUrlHash } from "./store";
import lzstring from "lz-string";

export function stateFromUrl() {
  const hash = window.location.hash;
  if (!hash) return DEFAULT_STATE;

  try {
    const state = JSON.parse(
      lzstring.decompressFromEncodedURIComponent(hash.slice(1))
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

// TODO: Avoid recomputing
export function getSerializabelState(state) {
  const { gratsResult, ...serializableState } = state;
  return serializableState;
}

export function bindStoreToUrl(store) {
  return onSelectorChange(store, getUrlHash, (urlHash) => {
    window.history.replaceState(null, null, urlHash);
  });
}
