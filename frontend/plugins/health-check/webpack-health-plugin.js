// Webpack plugin for health checks
class WebpackHealthPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('WebpackHealthPlugin', (stats) => {
      console.log('[Health] Build complete:', stats.hash);
    });
  }
}
module.exports = WebpackHealthPlugin;
