const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = function (_context, _options) {
  return {
    name: "monaco-editor",
    configureWebpack(_config, _isServer) {
      return {
        module: {
          rules: [
            /*
            {
              test: /\.ttf$/,
              use: ["file-loader"],
            },
            */
            {
              test: /\.ttf$/,
              type: "asset/resource",
            },
          ],
        },
        plugins: [
          new MonacoWebpackPlugin({
            languages: ["typescript", "graphql"],
          }),
        ],
      };
    },
  };
};
