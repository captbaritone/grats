// eslint-disable-next-line no-undef
module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/ban-ts-comment": "off", // I know what I'm doing (I hope)
    "@typescript-eslint/no-explicit-any": "off", // I know what I'm doing (I hope)
    "@typescript-eslint/no-var-requires": "off", // Some things are not using ESModules yet
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    // TODO: Enable this rule when we can turn it on for the website
    // and example projects.
    // "@typescript-eslint/consistent-type-imports": "error",
    "no-constant-condition": ["error", { checkLoops: false }],
    "no-constant-binary-expression": "error",
  },
  root: true,
  env: {
    browser: true,
    node: true,
  },
};
