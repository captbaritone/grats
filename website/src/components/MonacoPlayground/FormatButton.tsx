import React from "react";
import monaco from "monaco-editor";
import { FormatIcon } from "./icons";
import styles from "./playground.module.css";

/** Formats the file open in the editor. */
export default function FormatButton({
  getEditor,
}: {
  getEditor: () => monaco.editor.IStandaloneCodeEditor | undefined;
}) {
  return (
    <button
      className={styles.button}
      title="Format"
      aria-label="Format"
      onClick={() => {
        getEditor()?.getAction("editor.action.formatDocument")?.run();
      }}
    >
      <FormatIcon />
    </button>
  );
}
