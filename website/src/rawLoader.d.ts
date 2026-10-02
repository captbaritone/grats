// Webpack's raw-loader imports a file's text, as the default export.
declare module "!!raw-loader!*" {
  const text: string;
  export default text;
}
