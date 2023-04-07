const path = require("path");
const fs = require("fs");
const { buildSchemaResult } = require("grats");
const { printSchemaWithDirectives } = require("@graphql-tools/utils");
const glob = require("glob");
const { printSchema } = require("graphql");

async function main() {
  const gratsFiles = glob.sync("**/*.grats.ts");
  console.log("Found files to process:", gratsFiles);

  for (const file of gratsFiles) {
    processFile(file);
    console.log("[OK] Processed file:", file);
  }
}

main();

function processFile(file) {
  const files = [file /*, `src/Types.ts`*/];
  let options = {
    nullableByDefault: true,
  };
  const parsedOptions = {
    options: {},
    raw: {
      grats: options,
    },
    errors: [],
    fileNames: files,
  };
  const schemaResult = buildSchemaResult(parsedOptions);
  if (schemaResult.kind === "ERROR") {
    const errors = schemaResult.err.formatDiagnosticsWithContext();
    console.errors(errors);
    throw new Error("Invalid grats code");
  }

  const schema = schemaResult.value;
  schema._directives = schema._directives.filter(
    (directive) =>
      directive.name !== "exported" && directive.name !== "methodName",
  );
  const graphql = printSchema(schema, {
    assumeValid: true,
  });

  const fileContent = fs.readFileSync(file, "utf8");

  const output = `${fileContent}\n=== SNIP ===\n${graphql}`;

  const destFilename = `${file.replace(/\.grats\.ts$/, ".out")}`;

  fs.writeFileSync(destFilename, output);
}
