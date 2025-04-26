import { fileURLToPath } from "url";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8"),
);
const maybeVersion = pkg.version;
if (typeof maybeVersion !== "string") {
  throw new Error("Version is not a string");
}

export const version = maybeVersion;
