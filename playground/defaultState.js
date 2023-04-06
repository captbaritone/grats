import * as fs from "fs";
import * as path from "path";

// Parcel will inline this for us.
const CONTENT = fs.readFileSync(path.join(__dirname, "defaultText.ts"), "utf8");

export const DEFAULT_STATE = {
  doc: CONTENT,
  config: {
    nullableByDefault: true,
    reportTypeScriptTypeErrors: true,
  },
  view: {
    showGratsDirectives: false,
  },
  gratsResult: null,
  VERSION: 1,
};
