import React, { useState, useEffect } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { typescriptLanguage } from "@codemirror/lang-javascript";
import * as ts from "typescript";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { createLinter } from "../linter";
import lzstring from "lz-string";
import { createDefaultMapFromCDN } from "@typescript/vfs";
import { getConfig, getDoc, getView, onSelectorChange } from "../store";
import { createSelector } from "reselect";
import { Theme } from "./theme";
import store, { useUrlState } from "../store";

export default function InputView() {
  useEffect(() => {
    store.dispatch({ type: "SET_STATE_FROM_URL" });
  }, []);
  useUrlState(store);
  const [ref, setRef] = useState(null);
  const fsMap = useFsMap();
  useEffect(() => {
    if (ref != null && fsMap != null) {
      createInputView(store, fsMap, ref);
    }
  }, [ref, fsMap]);
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        flexGrow: 1,
      }}
      ref={setRef}
    ></div>
  );
}

function useFsMap() {
  const [fsMap, setFsMap] = useState(null);

  useEffect(() => {
    let unmounted = false;
    const shouldCache = true;
    createDefaultMapFromCDN(
      { target: ts.ScriptTarget.ES2021, lib: ["es2021"] },
      ts.version,
      shouldCache,
      ts,
      lzstring,
    ).then((fsMap) => {
      if (!unmounted) {
        setFsMap(fsMap);
      }
    });

    return () => {
      unmounted = true;
    };
  }, []);

  return fsMap;
}

// TODO: Make this into hooks
async function createInputView(store, fsMap, left) {
  const state = store.getState();
  console.log(state);

  // Create a selector that memoizes the linter and closes over the fsMap
  const getLinter = createSelector(getView, getConfig, (view, config) => {
    return createLinter(fsMap, view, config);
  });

  const linter = getLinter(state);

  const linterCompartment = new Compartment();
  const inputState = EditorState.create({
    doc: state.doc,
    extensions: [
      Theme,
      keymap.of(defaultKeymap),
      linterCompartment.of(linter),
      typescriptLanguage,
      EditorView.lineWrapping,
      lineNumbers(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ],
  });

  const leftView = new EditorView({ state: inputState, parent: left });

  // When the linter changes, update the linter
  onSelectorChange(store, getDoc, (doc) => {
    const state = leftView.state;
    if (state.doc.toString() === doc) {
      return;
    }
    const to = state.doc.length;
    const update = state.update({
      changes: { from: 0, to, insert: doc },
    });
    leftView.dispatch(update);
  });

  // When the linter changes, update the linter
  onSelectorChange(store, getLinter, (linter) => {
    leftView.dispatch({
      effects: linterCompartment.reconfigure(linter),
    });
  });
}
