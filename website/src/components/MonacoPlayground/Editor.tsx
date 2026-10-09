import React, { useRef, forwardRef } from "react";
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
  onChange?: (value: string) => void;
  onEditorDidMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

export const Editor = forwardRef<EditorRef, EditorProps>(
  (
    { value, language, theme, readOnly = false, onChange, onEditorDidMount },
    _ref,
  ) => {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    const handleEditorDidMount = (
      editor: monaco.editor.IStandaloneCodeEditor,
    ) => {
      editorRef.current = editor;
      onEditorDidMount?.(editor);
    };

    return (
      <MonacoEditor
        editorDidMount={handleEditorDidMount}
        onChange={onChange}
        value={value}
        language={language}
        theme={theme}
        options={{
          wordWrap: "on",
          minimap: { enabled: false },
          readOnly,
          fixedOverflowWidgets: true,
          fontSize: 14,
          lineHeight: 20,
          automaticLayout: true,
        }}
      />
    );
  },
);

Editor.displayName = "Editor";
