module.exports = function (context, options) {
  return {
    name: "custom-docusaurus-plugin",
    configureWebpack(config, isServer, utils) {
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
