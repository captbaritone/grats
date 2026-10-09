import React from "react";
import MonacoEditor from "react-monaco-editor";
import monaco from "monaco-editor";
import { useColorMode } from "@docusaurus/theme-common";

// The colors GraphiQL's own Monaco themes give its widgets (autocomplete,
// hovers, menus), since it uses these themes too.
function widgetColors({
  accent,
  accentTint,
  surface,
  inputTint,
  focusForeground,
}: Record<string, string>): monaco.editor.IColors {
  return {
    "scrollbar.shadow": "#00000000",
    "textLink.foreground": accent,
    "textLink.activeForeground": accent,
    "editorLink.activeForeground": accent,
    "editorHoverWidget.background": surface,
    "list.hoverBackground": accentTint,
    "list.highlightForeground": accent,
    "list.focusHighlightForeground": accent,
    "menu.background": surface,
    "menu.selectionBackground": accentTint,
    "menu.selectionForeground": accent,
    "editorSuggestWidget.background": surface,
    "editorSuggestWidget.selectedBackground": accentTint,
    "editorSuggestWidget.selectedForeground": accent,
    "quickInput.background": surface,
    "quickInput.widget": accent,
    "quickInputList.focusBackground": accentTint,
    "quickInputList.focusForeground": focusForeground,
    "highlighted.label": accent,
    highlight: accent,
    "editorWidget.background": surface,
    "editorWidget.resizeBorder": accent,
    "input.background": inputTint,
    focusBorder: accent,
    "toolbar.hoverBackground": accentTint,
    "inputOption.hoverBackground": accentTint,
    "pickerGroup.foreground": accent,
  };
}

// Monaco's themes, for the playground's editors and GraphiQL's, with
// transparent backgrounds so they sit flush with what's behind them.
monaco.editor.defineTheme("grats-light", {
  base: "vs",
  inherit: true,
  // Like GraphiQL's, which colors arguments distinctly.
  rules: [{ token: "argument.identifier.gql", foreground: "#6c69ce" }],
  colors: {
    "editor.background": "#00000000",
    "editor.lineHighlightBackground": "#f5f6f8",
    "editor.lineHighlightBorder": "#00000000",
    "editorLineNumber.foreground": "#b9bdc4",
    "editorLineNumber.activeForeground": "#606770",
    ...widgetColors({
      accent: "#d60590",
      accentTint: "#d6059019",
      surface: "#ffffff",
      inputTint: "#3b4b6811",
      focusForeground: "#444444",
    }),
  },
});
monaco.editor.defineTheme("grats-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [{ token: "argument.identifier.gql", foreground: "#908aff" }],
  colors: {
    "editor.background": "#00000000",
    "editor.lineHighlightBackground": "#ffffff08",
    "editor.lineHighlightBorder": "#00000000",
    "editorLineNumber.foreground": "#55585f",
    "editorLineNumber.activeForeground": "#a8abb3",
    ...widgetColors({
      accent: "#ff5794",
      accentTint: "#ff579419",
      surface: "#242427",
      inputTint: "#b7c2d711",
      focusForeground: "#ffffff",
    }),
  },
});

export const MONACO_THEMES = { light: "grats-light", dark: "grats-dark" };

/** The Monaco theme matching the site's color mode. */
function useMonacoTheme(): string {
  return MONACO_THEMES[useColorMode().colorMode];
}

// Unchanging, so the editor isn't reconfigured each render.
const OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  wordWrap: "on",
  minimap: { enabled: false },
  fixedOverflowWidgets: true,
  fontSize: 14,
  lineHeight: 21,
  automaticLayout: true,
  padding: { top: 14, bottom: 14 },
  scrollBeyondLastLine: false,
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  lineNumbersMinChars: 3,
  scrollbar: {
    useShadows: false,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
};
const READ_ONLY_OPTIONS = { ...OPTIONS, readOnly: true };

type EditorProps = {
  /**
   * The editor's text. Changing it replaces the text, so an editor whose text
   * is edited should be given its initial text, and not be passed each edit.
   */
  value: string;
  language: "typescript" | "graphql" | "json";
  readOnly?: boolean;
  /** The URI of the editor's model, e.g. for a JSON schema to match. */
  uri?: string;
  onChange?: (value: string) => void;
  onEditorDidMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
};

export function Editor({
  value,
  language,
  readOnly = false,
  uri,
  onChange,
  onEditorDidMount,
}: EditorProps) {
  const theme = useMonacoTheme();
  return (
    <MonacoEditor
      editorDidMount={onEditorDidMount}
      onChange={onChange}
      uri={uri == null ? undefined : (monaco) => monaco.Uri.parse(uri)}
      value={value}
      language={language}
      theme={theme}
      options={readOnly ? READ_ONLY_OPTIONS : OPTIONS}
    />
  );
}
