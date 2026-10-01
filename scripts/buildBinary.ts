import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { binaryPath } from "../bin/binaryPath.js";

/**
 * Compiles the native `grats` binary (`grats-rs/crates/grats_cli`) for the
 * current platform, and copies it to where `bin/grats.js` runs it from. The
 * published package has every platform's binary there, built in CI.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDir = path.join(root, "grats-rs");
const targetDir =
  process.env.CARGO_TARGET_DIR ?? path.join(workspaceDir, "target");

const destination = binaryPath();
if (destination == null) {
  throw new Error(
    `Grats has no binary for platform "${process.platform} (${process.arch})".`,
  );
}

execFileSync("cargo", ["build", "--release", "--package", "grats_cli"], {
  cwd: workspaceDir,
  stdio: "inherit",
});

fs.mkdirSync(path.dirname(destination), { recursive: true });
// A new file rather than overwriting the old one, which macOS would kill when
// run, since it caches code signatures by file.
fs.rmSync(destination, { force: true });
fs.copyFileSync(
  path.join(targetDir, "release", path.basename(destination)),
  destination,
);
