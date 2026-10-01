import GRATS_TYPE_DECLARATIONS from "!!raw-loader!grats/src/Types.ts";
import { Grats } from "./grats";

// Webpack emits the module as an asset. It's built by `pnpm run build:wasm`
// in the repository's root, which the website's scripts run first.
const WASM_URL = new URL(
  "../../../grats-rs/target/wasm32-unknown-unknown/release/grats_wasm.wasm",
  import.meta.url,
);

let grats: Promise<Grats> | null = null;

/** Fetches and loads the WebAssembly build of Grats, once. */
export function loadGrats(): Promise<Grats> {
  grats ??= fetch(WASM_URL)
    .then((response) => response.arrayBuffer())
    .then((bytes) => Grats.load(bytes));
  return grats;
}

/**
 * The packages which code in the playground can import: Grats' types, and the
 * types they import from `graphql`.
 */
export const PACKAGE_FILES: Record<string, string> = {
  "/node_modules/grats/package.json": JSON.stringify({
    name: "grats",
    types: "src/index.ts",
  }),
  "/node_modules/grats/src/index.ts": GRATS_TYPE_DECLARATIONS,
  "/node_modules/graphql/index.ts": `
    export type GraphQLResolveInfo = any;
    export type GraphQLScalarLiteralParser<T> = any;
    export type GraphQLScalarSerializer<T> = any;
    export type GraphQLScalarValueParser<T> = any;
  `,
};
