# Contributing

Below is some guidance on how to work on this project. If you have any questions, please feel free to open an issue.

## Automated Tests

Our tests are written as a collection of fixture files located in
`src/tests/fixtures`. Each `.ts` file nested within this directory is a test
case. The test runner will execute each test case and compare the output to
corresesponding `.expected.ts` file. If the output does not match the expected
output, the test runner will fail.

```
pnpm run test
```

To run a specific test case, you can use the `--filter` flag and provide a
substring match for the test case name.

```
pnpm run test -- --filter=import
```

To update fixture files, you can use the `--write` flag.

```
pnpm run test -- --write
```

All changes that affect the behavior of the tool, either new features of bug
fixes, should include at least one new or changed fixture file.

## Manual Tests

The code base includes an example server that can be used to manually test
features of the tool. To start the server, run the following command:

```
pnpm run example-server
```

This will start a web server running GraphiQL which you can use to try out the server.

## Testing with other projects

I haven't been able to get `npm link` to work with this project, perhaps because it hasn't been published yet? In the mean time, I've been using `"grats": "file:../path/to/tool"` in the `package.json` of the project I'm testing with.

Note: **Be sure to run `pnpm run build` first to build the tool.**