import * as path from "path";
import TestRunner from "./TestRunner";
import { printSchema } from "graphql";
import { _buildSchema } from "..";
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
    transformer: (code: string, fileName: string) => {
      const files = [`${fixturesDir}/${fileName}`, `src/Types.ts`];
      try {
        const schema = _buildSchema({
          files,
          sortSchema: false,
          nullableByDefault: true,
        });
        return printSchema(schema);
      } catch (e) {
        // TODO: WTF. Why is this not instanceof DiagnosticError?
        if (e.loc) {
          return stripColor(
            DiagnosticError.prototype.formatWithColorAndContext.call(e),
          );
        }
        throw e;
      }
    },
  },
];

function stripColor(str: string): string {
  return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");
}

main();
