import React from "react";
import prettier from "prettier/standalone";
import parserTypeScript from "prettier/parser-typescript";
import { getDoc } from "./store";

export default function FormatButton({ store }) {
  return (
    <button
      onClick={() => {
        const doc = getDoc(store.getState());
        const formatted = prettier.format(doc, {
          parser: "typescript",
          plugins: [parserTypeScript],
        });
        store.dispatch({ type: "NEW_DOCUMENT_TEXT", value: formatted });
      }}
    >
      Format
    </button>
  );
}
