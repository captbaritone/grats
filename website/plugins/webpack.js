const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = function (_context, _options) {
  return {
    name: "custom-docusaurus-plugin",
    configureWebpack(_config, _isServer, _utils) {
      return {
        resolve: {
          fallback: {
            path: require.resolve("path-browserify"),
          },
        },
        node: {
          __dirname: "mock",
        },
        module: {
          rules: [
            {
              test: /monaco.*\.css$/,
              use: ["style-loader", "css-loader"],
            },
            {
              test: /\.ttf$/,
              use: ["file-loader"],
            },
          ],
        },
        plugins: [
          new MonacoWebpackPlugin({
            languages: ["javascript", "json", "graphql"],
          }),
        ],
      };
    },
  };
};
