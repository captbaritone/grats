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
        // Can't figure out how to get this to work correctly to import the
        // codicon font. Instead, for now we just load it via CDN in
        // website/src/css/custom.css
        // module: {
        //   rules: [
        //     {
        //       test: /\.ttf$/,
        //       type: "asset/resource",
        //     },
        //   ],
        // },
        plugins: [
          new MonacoWebpackPlugin({
            languages: ["typescript", "javascript", "json", "graphql"],
          }),
        ],
      };
    },
  };
};
