import * as path from "path";
import TestRunner from "./TestRunner";
import { buildSchemaResult, GratsOptions } from "../lib";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import * as ts from "typescript";

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
      const firstLine = code.split("\n")[0];
      let options = {
        nullableByDefault: true,
      };
      if (firstLine.startsWith("// {")) {
        const json = firstLine.slice(3);
        const testOptions = JSON.parse(json);
        options = { ...options, ...testOptions };
      }
      const files = [`${fixturesDir}/${fileName}`, `src/Types.ts`];
      const parsedOptions: GratsOptions = {
        tsCompilerOptions: {},
        files,
        configOptions: options,
      };
      const schemaResult = buildSchemaResult(parsedOptions);
      if (schemaResult.kind === "ERROR") {
        return schemaResult.err.formatDiagnosticsWithContext();
      }
      return printSchemaWithDirectives(schemaResult.value, {
        assumeValid: true,
      });
    },
  },
];

main();
