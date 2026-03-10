import { ConfigSpec } from "./gratsConfig.js";
import _GratsConfigSpec from "./configSpecRaw.json" with { type: "json" };

// TypeScript does not preserve string literal types when importing JSON.
export const GratsConfigSpec: ConfigSpec = _GratsConfigSpec as any;
