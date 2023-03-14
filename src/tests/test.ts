import * as path from "path";
import TestRunner from "./TestRunner";
import { printSchema } from "graphql";
import { buildSchema } from "..";
import DiagnosticError from "../utils/DiagnosticError";

async function main() {
  const write = process.argv.some((arg) => arg === "--write");
  const filter = process.argv.find((arg) => arg.startsWith("--filter="));

  const filterRegex = filter != null ? filter.slice(9) : null;
  let failures = false;
  for (const { fixturesDir, transformer } of testDirs) {
    const runner = new TestRunner(fixturesDir, write, filterRegex, transformer);
    failures = !(await runner.run()) || failures;
  }
  if (failures) {
    process.exit(1);
  }
}

const fixturesDir = path.join(__dirname, "fixtures");

const testDirs = [
  {
    fixturesDir,
    transformer: async (code: string, fileName: string) => {
      const glob = `{${fixturesDir}/${fileName},src/Types.ts}`;
      try {
        const schema = await buildSchema(glob);
        return printSchema(schema);
      } catch (e) {
        // TODO: WTF. Why is this not instanceof DiagnosticError?
        if (e.loc) {
          return DiagnosticError.prototype.asCodeFrame.call(e, code, fileName);
        }
        throw e;
      }
    },
  },
];

main();
