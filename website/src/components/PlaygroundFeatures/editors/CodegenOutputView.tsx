import React, { useState, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { typescriptLanguage } from "@codemirror/lang-javascript";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { getTypeScriptOutputString, onSelectorChange } from "../store";
import { Theme } from "./theme";
import store from "../store";

export default function OutputView() {
  const [ref, setRef] = useState(null);
  useEffect(() => {
    if (ref != null) {
      createOutputView(store, ref);
    }
  }, [ref]);
  return (
    <div
      ref={setRef}
      style={{
        display: "flex",
        width: "100%",
        flexGrow: 1,
      }}
    ></div>
  );
}

export function createOutputView(store, right: HTMLDivElement) {
  const outputState = EditorState.create({
    doc: getTypeScriptOutputString(store.getState()),
    extensions: [
      Theme,
      keymap.of(defaultKeymap),
      lineNumbers(),
      typescriptLanguage,
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ],
  });

  const rightView = new EditorView({
    state: outputState,
    parent: right,
  });

  // When the output changes, update the output view
  onSelectorChange(store, getTypeScriptOutputString, (output) => {
    rightView.dispatch({
      changes: {
        from: 0,
        to: rightView.state.doc.length,
        insert: output,
      },
    });
  });
}
