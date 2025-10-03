import fs from "fs";
import {
  buildSchemaAndDocResult,
  codegen,
  printSDLWithoutMetadata,
  ReportableDiagnostics,
  type GratsConfig,
} from "grats";
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
    EXPERIMENTAL_tsEnumsHeader: null,
    EXPERIMENTAL__emitMetadata: false,
    EXPERIMENTAL__emitResolverMap: false,
    EXPERIMENTAL__emitEnums: null,
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
    const reportableDiagnostics = ReportableDiagnostics.fromDiagnostics(
      schemaAndDocResult.err,
    );
    const errors = reportableDiagnostics.formatDiagnosticsWithContext();
    console.error(errors);
    throw new Error("Invalid grats code");
  }

  const { doc, schema, resolvers } = schemaAndDocResult.value;
  const typeScript = codegen(schema, resolvers, config, file);
  const graphql = printSDLWithoutMetadata(doc);

  const fileContent = fs.readFileSync(file, "utf8");

  const output = `${fileContent}\n=== SNIP ===\n${graphql}\n=== SNIP ===\n${typeScript}`;

  const destFilename = `${file.replace(/\.grats\.ts$/, ".out")}`;

  fs.writeFileSync(destFilename, output);
}
