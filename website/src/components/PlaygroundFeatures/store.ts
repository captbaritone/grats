import { createStore } from "redux";
import { stateFromUrl } from "./urlState";
import { createSelector } from "reselect";
import lzstring from "lz-string";

export type State = {
  doc: string;
  config: {
    nullableByDefault: boolean;
    reportTypeScriptTypeErrors: boolean;
  };
  view: {
    showGratsDirectives: boolean;
  };
  gratsResult: null | string;
  VERSION: number;
};

export type Action =
  | {
      type: "SET_WHOLE_STATE";
      state: State;
    }
  | {
      type: "SHOW_GRATS_DIRECTIVE_INPUT_CHANGED";
      value: boolean;
    }
  | {
      type: "DEFAULT_NULLABLE_INPUT_CHANGED";
      value: boolean;
    }
  | {
      type: "GRATS_EMITTED_NEW_RESULT";
      value: string;
    }
  | {
      type: "NEW_DOCUMENT_TEXT";
      value: string;
    };

function reducer(state: State = stateFromUrl(), action: Action) {
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
    default:
      const _: never = action;
  }

  return state;
}

export function onSelectorChange<V>(
  store,
  selector: (state: State) => V,
  callback: (value: V) => void,
) {
  let previousState = selector(store.getState());
  return store.subscribe(() => {
    const newState = selector(store.getState());
    if (newState === previousState) return;
    previousState = newState;
    callback(newState);
  });
}

const store = createStore<State, Action, any, any>(reducer);

export function getView(state: State) {
  return state.view;
}

export function getConfig(state: State) {
  return state.config;
}

export function getDoc(state: State) {
  return state.doc;
}

export function getGratsResult(state: State) {
  return state.gratsResult;
}

export const getOutputString = createSelector(getGratsResult, (gratsResult) => {
  return gratsResult == null ? "Loading..." : gratsResult;
});

// TODO: Avoid recomputing
export function getSerializabelState(state: State) {
  const { gratsResult, ...serializableState } = state;
  return serializableState;
}

export const getUrlHash = createSelector(
  getSerializabelState,
  (serializableState) => {
    const hash = lzstring.compressToEncodedURIComponent(
      JSON.stringify(serializableState),
    );
    return "#" + hash;
  },
);

export default store;
