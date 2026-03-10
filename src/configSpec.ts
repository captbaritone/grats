import * as _GratsConfigSpec from "./configSpecRaw.json";
import { ConfigSpec } from "./gratsConfig.js";

// TypeScript does not preserve string literal types when importing JSON.
export const GratsConfigSpec: ConfigSpec = _GratsConfigSpec as any;
