// eslint-disable-next-line no-undef
module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-inferrable-types": "off",
  },
  root: true,
  env: {
    browser: true,
    node: true,
  },
};
