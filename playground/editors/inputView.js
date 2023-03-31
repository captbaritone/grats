import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { typescriptLanguage } from "@codemirror/lang-javascript";
import * as ts from "typescript";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { createLinter } from "../linter.js";
import lzstring from "lz-string";
import { createDefaultMapFromCDN } from "@typescript/vfs";
import { getConfig, getView, onSelectorChange } from "../store";
import { createSelector } from "reselect";
import { Theme } from "./theme";
import prettier from "prettier/standalone";
import parserTypeScript from "prettier/parser-typescript";

export async function createInputView(store) {
  const state = store.getState();

  const left = document.getElementById("left");

  const shouldCache = true;
  const fsMap = await createDefaultMapFromCDN(
    { target: ts.ScriptTarget.ES2015 },
    "3.7.3",
    shouldCache,
    ts,
    lzstring
  );

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

  const formatButton = document.getElementById("format-code");
  formatButton.addEventListener("click", () => {
    const state = leftView.state;
    const formatted = prettier.format(state.doc.toString(), {
      parser: "typescript",
      plugins: [parserTypeScript],
    });

    console.log({ state });
    const to = state.doc.length;
    console.log({ to });

    const update = state.update({
      changes: { from: 0, to, insert: formatted },
    });

    leftView.dispatch(update);
  });

  // When the linter changes, update the linter
  onSelectorChange(store, getLinter, (linter) => {
    console.log("linter changed", linter);
    leftView.dispatch({
      effects: linterCompartment.reconfigure(linter),
    });
  });
}
