const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

const PLAYGROUND_SW = "playground-sw";

module.exports = function (_context, _options) {
  return {
    name: "custom-docusaurus-plugin",
    configureWebpack(config, isServer, _utils) {
      return {
        // The playground's service worker must be served from a fixed path
        // outside of `/assets/`, so it can control `/playground`, and be self
        // contained, since a service worker must add its event listeners
        // synchronously, before any split chunks would be loaded.
        ...(isServer
          ? {}
          : {
              output: {
                filename: playgroundServiceWorkerFilename(
                  config.output.filename,
                ),
                chunkFilename: playgroundServiceWorkerFilename(
                  config.output.chunkFilename,
                ),
              },
              optimization: {
                splitChunks: {
                  // Webpack's default, `"async"`, includes workers' chunks.
                  chunks: (chunk) =>
                    !chunk.canBeInitial() && chunk.name !== PLAYGROUND_SW,
                },
              },
            }),
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

function playgroundServiceWorkerFilename(filename) {
  return (pathData, assetInfo) => {
    if (pathData.chunk?.name === PLAYGROUND_SW) {
      return `${PLAYGROUND_SW}.js`;
    }
    return typeof filename === "function"
      ? filename(pathData, assetInfo)
      : filename;
  };
}
