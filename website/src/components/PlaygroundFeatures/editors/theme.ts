import { EditorView } from "@codemirror/view";

export const Theme = EditorView.theme({
  "&": { fontSize: "18px" },
  ".cm-gutters": {
    backgroundColor: "var(--ifm-color-emphasis-100)",
    color: "var(--ifm-font-color-base)",
    border: "none",
    borderRight: "1px solid var(--ifm-color-emphasis-300)",
  },
});
