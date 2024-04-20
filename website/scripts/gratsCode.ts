import fs from "fs";
import { buildSchemaAndDocResult, codegen } from "grats";
import { printSDLWithoutMetadata, GratsConfig } from "grats";
import glob from "glob";

async function main() {
  const gratsFiles = glob.sync("**/*.grats.ts");
  console.log("Found files to process:", gratsFiles);

  for (const file of gratsFiles) {
    processFile(file);
    console.log("[OK] Processed file:", file);
  }
}

main();

function processFile(file: string) {
  const files = [file /*, `src/Types.ts`*/];
  const config: GratsConfig = {
    nullableByDefault: true,
    reportTypeScriptTypeErrors: true,
    importModuleSpecifierEnding: "",
    graphqlSchema: "schema.graphql",
    tsSchema: "schema.ts",
    strictSemanticNullability: false,
    schemaHeader: null,
    tsSchemaHeader: null,
  };
  const parsedOptions = {
    options: {},
    raw: {
      grats: config,
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
  const typeScript = codegen(schema, config, file);
  const graphql = printSDLWithoutMetadata(doc);

  const fileContent = fs.readFileSync(file, "utf8");

  const output = `${fileContent}\n=== SNIP ===\n${graphql}\n=== SNIP ===\n${typeScript}`;

  const destFilename = `${file.replace(/\.grats\.ts$/, ".out")}`;

  fs.writeFileSync(destFilename, output);
}
