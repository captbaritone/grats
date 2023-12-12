const fs = require("fs");
const { buildSchemaResult, codegen } = require("grats");
const { printSDLWithoutDirectives } = require("grats");
const glob = require("glob");

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
    reportTypeScriptTypeErrors: true,
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
    console.error(errors);
    throw new Error("Invalid grats code");
  }

  const schema = schemaResult.value;
  const typeScript = codegen(schema, file, options);
  const graphql = printSDLWithoutDirectives(schema);

  const fileContent = fs.readFileSync(file, "utf8");

  const output = `${fileContent}\n=== SNIP ===\n${graphql}\n=== SNIP ===\n${typeScript}`;

  const destFilename = `${file.replace(/\.grats\.ts$/, ".out")}`;

  fs.writeFileSync(destFilename, output);
}
