import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";

/** Create a large Grats project for performance testing */

export async function main() {
  // Create a temp directory to run the benchmark in.
  const tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "grats-benchmark-tests-"),
  );

  // Create a tsconfig.json file.
  const tsConfigPath = path.join(tmpDir, "tsconfig.json");
  const tsConfig = {
    grats: {
      // See Configuration for all available options
    },
    compilerOptions: {
      strictNullChecks: true,
      module: "NodeNext",
      outDir: "./dist",
    },
  };
  await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2));

  // Create a large number of TypeScript files with GraphQL definitions.
  const numFiles = 10000;
  const template = (fileIndex: number): string => {
    let prelude = "";
    let edge = "";
    let prevType = "";
    if (fileIndex > 0) {
      prevType = `Type${fileIndex - 1}`;
      prelude = `import { ${prevType} } from "./file${fileIndex - 1}";\n`;
      edge = `  /** @gqlField */
  previous(): ${prevType} {
    return new ${prevType}();
  }`;
    }
    return `
${prelude}

/** @gqlType */
export class Type${fileIndex} {
  /** @gqlField */
  field(): string {
    return "Hello, world!";
  }
  
  /** @gqlQueryField */
  static getType${fileIndex}(): string {
    return new Type${fileIndex}();
  }

  ${edge}
}

/** @gqlEnum */
export enum Enum${fileIndex} {
  VALUE_A = "VALUE_A",
  VALUE_B = "VALUE_B",
  VALUE_C = "VALUE_C",
}

/** @gqlInput */
type Input${fileIndex} = {
  field: string;
  someEnum: Enum${fileIndex};
}

/** @gqlMutationField */
export function createType${fileIndex}(input: Input${fileIndex}): Type${fileIndex} {
  return new Type${fileIndex}();
}

/** @gqlQueryField */
export function queryField${fileIndex}(): string {
  return "Hello, world!";
}`;
  };

  console.log(`Creating ${numFiles} files in ${tmpDir}...`);

  for (let i = 0; i < numFiles; i++) {
    const fileContents = template(i);
    const filePath = path.join(tmpDir, `file${i}.ts`);
    await fs.writeFile(filePath, fileContents);
  }

  console.log("Created files.");

  // Change directory to the temp directory.
  // process.chdir(tmpDir);

  // Run Grats in the temp directory and take a performance profile
  console.log("Running Grats...");
  console.time("Grats completed in");
  execSync(
    `node --cpu-prof --cpu-prof-name=performance.cpuprofile ./dist/src/cli.js --tsconfig ${tsConfigPath}`,
    {
      stdio: "inherit",
    },
  );
  console.timeEnd("Grats completed in");

  console.log(`Profile written to ${path.join(process.cwd(), "performance.cpuprofile")}`);
  console.log("Drag into the performance tab of Chrome DevTools to view.");


  console.log("Cleaning up...");
  // Clean up the temp directory.
  await fs.rm(tmpDir, { recursive: true, force: true });
}

main();
