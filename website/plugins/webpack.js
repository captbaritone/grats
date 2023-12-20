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
      };
    },
  };
};
