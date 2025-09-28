import React from "react";
// import prettier from "prettier/standalone";
// import parserTypeScript from "prettier/parser-typescript";

export default function FormatButton() {
  return (
    <button
      onClick={() => {
        // const doc = getDoc(store.getState());
        // const formatted = prettier.format(doc, {
        //   parser: "typescript",
        //   plugins: [parserTypeScript],
        // });
        // store.dispatch({ type: "NEW_DOCUMENT_TEXT", value: formatted });
      }}
    >
      Format
    </button>
  );
}
