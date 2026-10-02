// LLM agent docs: See the llm-docs/ directory in the package root for
// Markdown documentation covering all Grats features and configuration.

// Grats is a native binary (see `bin/grats.js`). This module only provides
// the types which Grats projects import. It's empty at runtime, for setups
// which don't elide `import { Int } from "grats"`.

export * from "./Types.js";
