import * as path from "path";
import { extract } from "../extract";
import TestRunner from "./TestRunner";
import { printSchema, buildASTSchema } from "graphql";

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

const testDirs = [
  {
    fixturesDir: path.join(__dirname, "fixtures"),
    transformer: async (code: string, fileName: string) => {
      const ast = extract(code);
      return printSchema(buildASTSchema(ast));
    },
  },
];

main();
