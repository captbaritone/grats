import { spawn } from "child_process";
import fetch from "node-fetch";
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Runs each of our example projects as an integration test.
 *
 * See /examples/README.md for more information about how
 * these tests work.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testCases = [
  {
    name: "Simple query",
    query: `query { me { name } }`,
    variables: {},
    expected: { data: { me: { name: "Alice" } } },
  },
  {
    name: "All users",
    query: `query { allUsers { name } }`,
    variables: {},
    expected: { data: { allUsers: [{ name: "Alice" }, { name: "Alice" }] } },
  },
];

async function main() {
  const EXAMPLES_DIR = path.join(__dirname, "../../examples");
  for (const example of fs.readdirSync(EXAMPLES_DIR)) {
    const examplePath = path.join(EXAMPLES_DIR, example);
    if (!fs.lstatSync(examplePath).isDirectory()) {
      // Skip README.md and any other files
      continue;
    }
    console.log(`Testing example "${example}"...`);
    await testExample(example, examplePath);
    console.log(`[OK!] ${example}`);
  }
}
main();

async function testExample(exampleName, exampleDir) {
  let testConfig = {
    port: 4000,
    route: "graphql",
  };
  const testConfigPath = path.join(exampleDir, "testConfig.json");
  // Check for test config
  if (fs.existsSync(testConfigPath)) {
    testConfig = {
      ...testConfig,
      ...JSON.parse(fs.readFileSync(testConfigPath, "utf-8")),
    };
  }

  const url = `http://localhost:${testConfig.port}/${testConfig.route}`;
  await withExampleServer(exampleDir, async () => {
    for (const testCase of testCases) {
      console.log(`  Running test case "${testCase.name}"...`);
      const actual = await fetchQuery(url, testCase.query, testCase.variables);
      assert.deepEqual(actual, testCase.expected);
      console.log(`  [OK] ${testCase.name}...`);
    }
  });
}

async function fetchQuery(url, query, variables) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  return response.json();
}

async function withExampleServer(exampleDir, cb) {
  const child = spawn("pnpm", ["run", "--silent", "start"], {
    cwd: exampleDir,
    stdio: "pipe",
    detached: true,
  });
  child.stderr.on("data", (data) => {
    console.error(`${exampleDir} stderr: ${data}`);
  });
  child.on("exit", (code) => {
    // Code can be `null` sometimes
    if (code) {
      console.error(`${exampleDir}: Child process exited with code ${code}`);
      process.exit(code);
    }
  });
  try {
    // HACK: Wait for the server to start
    // Call once per console.log in the server
    await awaitProcessData(child);
    await cb();
  } finally {
    process.kill(-child.pid, "SIGTERM"); // Negative PID kills the entire process group
  }
}

function awaitProcessData(child) {
  return new Promise((resolve) => {
    child.stdout.on("data", () => {
      resolve();
    });
  });
}
