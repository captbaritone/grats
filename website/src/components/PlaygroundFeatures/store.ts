import { useEffect } from "react";
import { createStore } from "redux";
import { serializeState, stateFromUrl } from "./urlState";
import { createSelector } from "reselect";

import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

export type State = {
  doc: string;
  config: {
    nullableByDefault: boolean;
    reportTypeScriptTypeErrors: boolean;
  };
  view: {
    outputOption: "sdl" | "typescript";
  };
  gratsResult: null | {
    graphql: string;
    typescript: string;
  };
  VERSION: number;
};

export type Action =
  | {
      type: "SET_STATE_FROM_URL";
    }
  | {
      type: "SET_WHOLE_STATE";
      state: State;
    }
  | {
      type: "DEFAULT_NULLABLE_INPUT_CHANGED";
      value: boolean;
    }
  | {
      type: "GRATS_EMITTED_NEW_RESULT";
      graphql: string;
      typescript: string;
    }
  | {
      type: "NEW_DOCUMENT_TEXT";
      value: string;
    }
  | {
      type: "OUTPUT_VIEW_SELECTION_CHANGED";
      value: "sdl" | "typescript";
    };

function reducer(state: State = stateFromUrl(), action: Action) {
  switch (action.type) {
    case "SET_STATE_FROM_URL":
      return stateFromUrl();
    case "SET_WHOLE_STATE":
      return action.state;
    case "OUTPUT_VIEW_SELECTION_CHANGED":
      return {
        ...state,
        view: {
          ...state.view,
          outputOption: action.value,
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
        gratsResult: {
          graphql: action.graphql,
          typescript: action.typescript,
        },
      };
    case "NEW_DOCUMENT_TEXT": {
      return {
        ...state,
        doc: action.value,
      };
    }
    default: {
      const _: never = action;
    }
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

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: (action: Action) => void = useDispatch;
export const useAppSelector: TypedUseSelectorHook<State> = useSelector;

export function getView(state: State) {
  return state.view;
}

export function getConfig(state: State) {
  return state.config;
}

export function getDoc(state: State) {
  return state.doc;
}

export function getOutputOption(state: State): "sdl" | "typescript" {
  return state.view.outputOption;
}

export function getGratsGraphqlResult(state: State): string | null {
  return state.gratsResult?.graphql;
}

export function getGratsTypeScriptResult(state: State): string | null {
  return state.gratsResult?.typescript;
}

export function getNullableByDefault(state): boolean {
  return state.config.nullableByDefault;
}

export const getGraphQLOutputString = createSelector(
  getGratsGraphqlResult,
  (gratsResult) => {
    return gratsResult == null ? "Loading..." : gratsResult;
  },
);

export const getTypeScriptOutputString = createSelector(
  getGratsTypeScriptResult,
  (gratsResult) => {
    return gratsResult == null ? "Loading..." : gratsResult;
  },
);

export type SerializableState = {
  doc: string;
  config: {
    nullableByDefault: boolean;
    reportTypeScriptTypeErrors: boolean;
  };
  view: {
    outputOption: "sdl" | "typescript";
  };
  VERSION: number;
};

// TODO: Avoid recomputing
export function getSerializabelState(state: State): SerializableState {
  const { gratsResult, ...serializableState } = state;
  return serializableState;
}

export const getUrlHash = createSelector(
  getSerializabelState,
  (serializableState) => {
    return "#" + serializeState(serializableState);
  },
);
export function useUrlState(store) {
  useEffect(() => {
    const hash = getUrlHash(store.getState());
    window.history.replaceState(null, null, hash);
    return onSelectorChange(store, getUrlHash, (urlHash) => {
      window.history.replaceState(null, null, urlHash);
    });
  }, [store]);
}

export default store;
