import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { typescriptLanguage } from "@codemirror/lang-javascript";
import { graphqlLanguage } from "cm6-graphql";
import * as ts from "typescript";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { createLinter } from "./linter.js";
import lzstring from "lz-string";
import { createDefaultMapFromCDN } from "@typescript/vfs";

const Theme = EditorView.theme({
  "&": { fontSize: "18px" },
});

const CONTENT = `/** @gqlType */
export default class Query {
  /** @gqlField */
  me(): UserResolver {
    return new UserResolver();
  }
  /** 
   * @gqlField
   * @deprecated Please use \`me\` instead.
   */
  viewer(): UserResolver {
    return new UserResolver();
  }
}

/**
 * A user in our kick-ass system!
 * @gqlType User
 */
class UserResolver {
  /** @gqlField */
  name: string = 'Alice';

  /** @gqlField */
  greeting(args: { salutation: string }): string {
    return \`\${args.salutation}, \${this.name}\`;
  }
}`;

const DEFAULT_STATE = {
  doc: CONTENT,
  config: {
    nullableByDefault: false,
  },
  VERSION: 1,
};

function stateFromUrl() {
  const hash = window.location.hash;
  if (!hash) return DEFAULT_STATE;

  try {
    const state = JSON.parse(
      lzstring.decompressFromEncodedURIComponent(hash.slice(1))
    );
    if (state.VERSION === 1) return state;
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_STATE;
}

async function main() {
  const state = stateFromUrl();
  document.getElementById("default-nullable").checked =
    state.config.nullableByDefault;
  const app = document.getElementById("app");
  app.style.display = "flex";
  app.style.flexDirection = "row";
  const left = document.createElement("div");
  left.style.width = "100%";
  const right = document.createElement("div");
  right.style.width = "100%";

  app.appendChild(left);
  app.appendChild(right);

  let outputState = EditorState.create({
    doc: "",
    extensions: [
      Theme,
      keymap.of(defaultKeymap),
      lineNumbers(),
      graphqlLanguage,
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ],
  });

  let rightView = new EditorView({
    state: outputState,
    parent: right,
  });

  const shouldCache = true;
  const fsMap = await createDefaultMapFromCDN(
    { target: ts.ScriptTarget.ES2015 },
    "3.7.3",
    shouldCache,
    ts,
    lzstring
  );

  const linter = createLinter(rightView, fsMap);
  let inputState = EditorState.create({
    doc: state.doc,
    extensions: [
      Theme,
      keymap.of(defaultKeymap),
      linter,
      typescriptLanguage,
      EditorView.lineWrapping,
      lineNumbers(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ],
  });

  let leftView = new EditorView({
    state: inputState,
    parent: left,
  });
}

main();
