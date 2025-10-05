import React from "react";
import { SANDBOX } from "./Sandbox";

export default function FormatButton() {
  return (
    <button
      onClick={async () => {
        const editor = SANDBOX._tsEditor;
        if (!editor) {
          console.warn("No editor");
          return;
        }
        const formatAction = editor.getAction("editor.action.formatDocument");
        if (!formatAction) {
          console.warn("No format action");
          return;
        }
        formatAction.run();
      }}
    >
      Format
    </button>
  );
}
