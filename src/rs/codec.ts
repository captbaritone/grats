import type { GratsConfig } from "../gratsConfig.js";
import type { RustProgramOptions } from "./host.js";

/**
 * Types of the JSON passed between TypeScript and the Rust port of Grats
 * (compiled to wasm).
 */

/**
 * The input to the `run_pipeline` entry point. See `PipelineRequest` in
 * `grats-rs/crates/grats_wasm/src/lib.rs`.
 */
export type RustPipelineRequest = {
  config: GratsConfig;
  gratsRoot: string;
  program: RustProgramOptions;
};

/**
 * The input to the `print_outputs` entry point, besides the document. See
 * `OutputRequest` in `grats-rs/crates/grats/src/print_schema.rs`.
 */
export type RustOutputRequest = {
  config: GratsConfig;
  gratsRoot: string;
  graphqlSchema: boolean;
  tsSchema: string | null;
  tsClientEnums: string | null;
  metadata: boolean;
};

/**
 * The requests of the entry points which use the document kept by `run_pipeline`.
 */
export type RustDocumentRequests = {
  print_outputs: RustOutputRequest;
  print_sdl_without_metadata: null;
};
