import React, { useEffect, useState } from "react";
import store, { getDoc, useAppSelector } from "../PlaygroundFeatures/store";
import { monaco as Monaco } from "react-monaco-editor";
import { getDiagnostics } from "../PlaygroundFeatures/gratsStoreBindings";
import {
  codeActionsForDiagnostics,
  resolveDiagnosticLocation,
} from "./diagnostics";
import MonacoEditor from "./MonacoEditor";

export default function InputEditor() {
  const diagnostics = useAppSelector(getDiagnostics);
  const [editor, setEditor] =
    useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof Monaco | null>(null);
  const doc = useAppSelector(getDoc);

  useEffect(() => {
    if (editor == null || monaco == null) {
      return;
    }
    if (diagnostics == null) {
      return;
    }
    const model = editor.getModel();
    if (model == null) {
      return;
    }
    const text = editor.getValue();
    const markers = diagnostics.map((diagnostic) => {
      const { startLineNumber, startColumn, endLineNumber, endColumn } =
        resolveDiagnosticLocation(text, diagnostic.start, diagnostic.length);

      return {
        severity: monaco.MarkerSeverity.Error,
        message: diagnostic.messageText,
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn,
      };
    });
    monaco.editor.setModelMarkers(model, "owner", markers);
    const disposable = monaco.languages.registerCodeActionProvider(
      "typescript",
      {
        provideCodeActions: (model, _range, _context, _token) => {
          const actions = codeActionsForDiagnostics(text, model, diagnostics);
          return {
            actions: actions,
            dispose: () => {
              // noop
            },
          };
        },
      },
    );

    return () => {
      disposable.dispose();
    };
  }, [editor, monaco, diagnostics]);

  const newDoc = debounce((value) => {
    store.dispatch({ type: "NEW_DOCUMENT_TEXT", value });
  });

  return (
    <MonacoEditor
      language="typescript"
      value={doc}
      onChange={(value: string) => {
        newDoc(value);
      }}
      editorDidMount={(editor, monaco) => {
        setEditor(editor);
        setMonaco(monaco);
        editor.focus();
      }}
    />
  );
}

function debounce(func, wait = 500) {
  let timeout;
  return function (...args) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}
