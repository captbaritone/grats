import MonacoEditor from "react-monaco-editor";
import Layout from "@theme/Layout";
import { useColorMode } from "@docusaurus/theme-common";
import React, { useEffect, useState } from "react";
import ConfigBar from "../../../components/PlaygroundFeatures/ConfigBar";
import store, {
  getDoc,
  useAppSelector,
} from "../../../components/PlaygroundFeatures/store";
import { Provider } from "react-redux";
import BrowserOnly from "@docusaurus/BrowserOnly";
import FillRemainingHeight from "../../../components/PlaygroundFeatures/FillRemainingHeight.tsx";
import { monaco as Monaco } from "react-monaco-editor";
import { bindGratsToStore } from "../../../components/PlaygroundFeatures/gratsStoreBindings.ts";
import {
  codeActionsForDiagnostics,
  resolveDiagnosticLocation,
} from "./diagnostics";

function debounce(func, wait = 500) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

function OutputEditor({ gratsSelectors, store }) {
  const value =
    gratsSelectors?.getSchemaText(store.getState()) ?? "NOT COMPUTED";
  return (
    <Editor value={value} options={{ readOnly: true }} language="graphql" />
  );
}

function InputEditor({ diagnostics }) {
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
          return { actions: actions, dispose: () => {} };
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
    <Editor
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

function Editor(props) {
  const { colorMode } = useColorMode();

  function onEditorWillMount(monaco) {
    const vsDarkTheme = {
      base: "vs-dark",
      inherit: true,
      rules: [{ background: "121212" }],
      colors: {
        "editor.background": "#121212",
      },
    };

    monaco.editor.defineTheme("vs-dark", vsDarkTheme);

    if (props.editorWillMount) {
      props.editorWillMount(monaco);
    }
  }

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MonacoEditor
        {...props}
        options={{
          ...(props.options ?? {}),
          minimap: { enabled: false },
        }}
        onEditorWillMount={onEditorWillMount}
        editorDidMount={(editor, monaco) => {
          if (props.editorDidMount) {
            props.editorDidMount(editor, monaco);
          }
        }}
        theme={colorMode === "dark" ? "vs-dark" : "vs-light"}
      />
    </div>
  );
}

function Editors() {
  const [gratsSelectors, setGratsSelectors] = useState(null);
  useEffect(() => {
    if (gratsSelectors !== null) {
      return;
    }
    bindGratsToStore().then((selectors) => {
      setGratsSelectors(selectors);
    });
    return () => {
      // Cleanup?
    };
  });
  const diagnostics = useAppSelector(
    gratsSelectors == null ? () => null : gratsSelectors.getDiagnostics,
  );
  return (
    <>
      <div
        style={{
          display: "flex",
          width: "100%",
          flexGrow: 1,
        }}
      >
        <InputEditor diagnostics={diagnostics} />
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          flexGrow: 1,
        }}
      >
        {/*<OutputEditor gratsSelectors={gratsSelectors} store={store} />*/}
      </div>
    </>
  );
}

export default function EditorView() {
  return (
    <Layout title={`Playground`} noFooter>
      <BrowserOnly>
        {() => (
          <FillRemainingHeight minHeight={300}>
            <Provider store={store}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <ConfigBar />
                <div
                  style={{
                    flexGrow: 1,
                    position: "relative",
                    top: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    flexDirection: "row",
                    overflow: "scroll",
                  }}
                >
                  <Editors />
                </div>
              </div>
            </Provider>
          </FillRemainingHeight>
        )}
      </BrowserOnly>
    </Layout>
  );
}
