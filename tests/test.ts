import * as path from "path";
import { extract } from "../extract";
import TestRunner from "./TestRunner";
import { printSchema, buildASTSchema, validateSchema } from "graphql";
import { validateSDL } from "graphql/validation/validate";
import { parseForESLint } from "@typescript-eslint/parser";
import { traverse } from "../Traverse";
import DiagnosticError from "../DiagnosticError";

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
      const { ast, scopeManager } = parseForESLint(code, {
        comment: true,
        loc: true,
        // Omitting this breaks the scope manager
        range: true,
      });

      const schemaResult = traverse(ast, code, scopeManager);
      switch (schemaResult.type) {
        case "ERROR":
          return schemaResult.error
            .map((error) =>
              DiagnosticError.prototype.asCodeFrame.call(error, code, fileName),
            )
            .join("\n");
        case "OK":
          return printSchema(buildASTSchema(schemaResult.value));
      }
    },
  },
];

main();
