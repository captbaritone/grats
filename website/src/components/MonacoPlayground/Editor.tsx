import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import MonacoEditor from "react-monaco-editor";
import monaco from "monaco-editor";

export interface EditorRef {
  layout: () => void;
}

interface EditorProps {
  value: string;
  language: "typescript" | "graphql" | "json";
  theme: string;
  readOnly?: boolean;
  onEditorDidMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

export const Editor = forwardRef<EditorRef, EditorProps>(
  ({ value, language, theme, readOnly = false, onEditorDidMount }, ref) => {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    useImperativeHandle(ref, () => ({
      layout: () => {
        editorRef.current?.layout();
      },
    }));

    useEffect(() => {
      if (editorRef.current == null) {
        return;
      }
      function handler() {
        editorRef.current!.layout();
      }

      window.addEventListener("resize", handler);
      return () => {
        window.removeEventListener("resize", handler);
      };
    });

    const handleEditorDidMount = (
      editor: monaco.editor.IStandaloneCodeEditor,
    ) => {
      editorRef.current = editor;
      onEditorDidMount?.(editor);
    };

    return (
      <MonacoEditor
        editorDidMount={handleEditorDidMount}
        value={value}
        language={language}
        theme={theme}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          readOnly,
        }}
      />
    );
  },
);

Editor.displayName = "Editor";
