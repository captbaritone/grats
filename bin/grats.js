#!/usr/bin/env node

// LLM agent docs: See the llm-docs/ directory in the package root for
// Markdown documentation covering all Grats features and configuration.

// Grats is a native binary. This runs the current platform's.

import { spawn } from "child_process";
import { binaryPath } from "./binaryPath.js";

const binary = binaryPath();
if (binary == null) {
  console.error(
    `Grats: Platform "${process.platform} (${process.arch})" is not supported.`,
  );
  process.exit(1);
}

spawn(binary, process.argv.slice(2), { stdio: "inherit" })
  .on("error", (error) => {
    console.error(`Grats: Could not run ${binary}: ${error.message}`);
    process.exit(1);
  })
  .on("exit", (code, signal) => {
    if (signal != null) {
      // Die the way the binary did.
      process.kill(process.pid, signal);
    } else {
      process.exit(code);
    }
  });
