import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { graphqlLanguage } from "cm6-graphql";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { getOutputString, onSelectorChange } from "../store";
import { Theme } from "./theme";

export function createOutputView(store) {
  const right = document.getElementById("right");

  let outputState = EditorState.create({
    doc: getOutputString(store.getState()),
    extensions: [
      Theme,
      keymap.of(defaultKeymap),
      lineNumbers(),
      graphqlLanguage,
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ],
  });

  let rightView = new EditorView({
    state: outputState,
    parent: right,
  });

  // When the output changes, update the output view
  onSelectorChange(store, getOutputString, (output) => {
    rightView.dispatch({
      changes: {
        from: 0,
        to: rightView.state.doc.length,
        insert: output,
      },
    });
  });
}
