import { createRequire } from "module";
import { ConfigSpec } from "./gratsConfig.js";

// Use createRequire to load JSON in ESM without `import ... with { type: "json" }`
// which is not supported by webpack's babel-loader (used by the playground).
const require = createRequire(import.meta.url);
const _GratsConfigSpec = require("./configSpecRaw.json");

// TypeScript does not preserve string literal types when importing JSON.
export const GratsConfigSpec: ConfigSpec = _GratsConfigSpec as any;
