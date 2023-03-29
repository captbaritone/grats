import { createStore } from "redux";
import { stateFromUrl } from "./urlState";
import { createSelector } from "reselect";
import lzstring from "lz-string";

function reducer(state = stateFromUrl(), action) {
  switch (action.type) {
    case "SET_WHOLE_STATE":
      return action.state;
    case "SHOW_GRATS_DIRECTIVE_INPUT_CHANGED":
      return {
        ...state,
        view: {
          ...state.view,
          showGratsDirectives: action.value,
        },
      };
    case "DEFAULT_NULLABLE_INPUT_CHANGED":
      return {
        ...state,
        config: {
          ...state.config,
          nullableByDefault: action.value,
        },
      };
    case "GRATS_EMITTED_NEW_RESULT":
      return {
        ...state,
        gratsResult: action.value,
      };
    case "NEW_DOCUMENT_TEXT": {
      return {
        ...state,
        doc: action.value,
      };
    }
  }

  return state;
}

export function onSelectorChange(store, selector, callback) {
  let previousState = selector(store.getState());
  return store.subscribe(() => {
    const newState = selector(store.getState());
    if (newState === previousState) return;
    previousState = newState;
    callback(newState);
  });
}

const store = createStore(reducer);

export function getView(state) {
  return state.view;
}

export function getConfig(state) {
  return state.config;
}

export function getGratsResult(state) {
  return state.gratsResult;
}

export const getOutputString = createSelector(getGratsResult, (gratsResult) => {
  return gratsResult == null ? "Loading..." : gratsResult;
});

// TODO: Avoid recomputing
export function getSerializabelState(state) {
  const { gratsResult, ...serializableState } = state;
  return serializableState;
}

export const getUrlHash = createSelector(
  getSerializabelState,
  (serializableState) => {
    const hash = lzstring.compressToEncodedURIComponent(
      JSON.stringify(serializableState)
    );
    return "#" + hash;
  }
);

export default store;
