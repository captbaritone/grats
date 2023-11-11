import { fork } from "child_process";
import fetch from "node-fetch";
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
    console.log(`Testing example "${example}"...`);
    await testExample(example, path.join(EXAMPLES_DIR, example));
    console.log(`[OK!] ${example}`);
  }
}
main();

async function testExample(exampleName, exampleDir) {
  await withExampleServer(exampleDir, async () => {
    for (const testCase of testCases) {
      console.log(`  Running test case "${testCase.name}"...`);
      const actual = await fetchQuery(testCase.query, testCase.variables);
      assert.deepEqual(actual, testCase.expected);
      console.log(`  [OK] ${testCase.name}...`);
    }
  });
}

async function fetchQuery(query, variables) {
  const response = await fetch("http://localhost:4000/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  return response.json();
}

async function withExampleServer(exampleDir, cb) {
  const child = fork("./dist/server.js", {
    cwd: exampleDir,
    stdio: "pipe",
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
    // Not clear why we need two
    await awaitProcessData(child);
    await awaitProcessData(child);
    await cb();
  } finally {
    child.kill("SIGINT");
  }
}

function awaitProcessData(child) {
  return new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => {
      resolve();
    });
  });
}
