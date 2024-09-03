import React, { useRef, useState, useEffect } from "react";
import MonacoEditorImpl, { MonacoEditorProps } from "react-monaco-editor";
import { useColorMode } from "@docusaurus/theme-common";

export default function MonacoEditor(props: MonacoEditorProps) {
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
    <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
      <ResizableComponent>
        {({ width, height }) => (
          <MonacoEditorImpl
            {...props}
            width={width}
            height={height}
            options={{
              ...(props.options ?? {}),
              minimap: { enabled: false },
            }}
            // @ts-ignore
            onEditorWillMount={onEditorWillMount}
            editorDidMount={(editor, monaco) => {
              if (props.editorDidMount) {
                props.editorDidMount(editor, monaco);
              }
            }}
            theme={colorMode === "dark" ? "vs-dark" : "vs-light"}
          />
        )}
      </ResizableComponent>
    </div>
  );
}

const ResizableComponent = ({ children }) => {
  const ref = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (ref.current) {
        setDimensions({
          // @ts-ignore
          width: ref.current.offsetWidth,
          // @ts-ignore
          height: ref.current.offsetHeight,
        });
      }
    };

    updateDimensions(); // Initial measurement
    window.addEventListener("resize", updateDimensions); // Update on window resize

    return () => {
      window.removeEventListener("resize", updateDimensions); // Cleanup
    };
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {children({ ...dimensions })}
    </div>
  );
};
