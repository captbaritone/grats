const fs = require("fs");
const { buildSchemaAndDocResult, codegen } = require("grats");
const { printSDLWithoutMetadata } = require("grats");
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
    importModuleSpecifierEnding: "",
  };
  const parsedOptions = {
    options: {},
    raw: {
      grats: options,
    },
    errors: [],
    fileNames: files,
  };
  const schemaAndDocResult = buildSchemaAndDocResult(parsedOptions);
  if (schemaAndDocResult.kind === "ERROR") {
    const errors = schemaAndDocResult.err.formatDiagnosticsWithContext();
    console.error(errors);
    throw new Error("Invalid grats code");
  }

  const { doc, schema } = schemaAndDocResult.value;
  const typeScript = codegen(schema, options, file);
  const graphql = printSDLWithoutMetadata(doc);

  const fileContent = fs.readFileSync(file, "utf8");

  const output = `${fileContent}\n=== SNIP ===\n${graphql}\n=== SNIP ===\n${typeScript}`;

  const destFilename = `${file.replace(/\.grats\.ts$/, ".out")}`;

  fs.writeFileSync(destFilename, output);
}
