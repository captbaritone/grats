import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Where the native `grats` binary for each `${process.platform}-${process.arch}`
 * lives, relative to this directory. The publish job in
 * `.github/workflows/ci.yaml` puts each platform's binary here, and
 * `pnpm build` puts the current platform's.
 */
const BINARIES = {
  "darwin-x64": "macos-x64/grats",
  "darwin-arm64": "macos-arm64/grats",
  "linux-x64": "linux-x64/grats",
  "linux-arm64": "linux-arm64/grats",
  "win32-x64": "win-x64/grats.exe",
};

/**
 * The absolute path of the binary for the current platform, or null if
 * there's no binary for it.
 */
export function binaryPath() {
  const binary = BINARIES[`${process.platform}-${process.arch}`];
  if (binary == null) {
    return null;
  }
  return join(dirname(fileURLToPath(import.meta.url)), binary);
}
