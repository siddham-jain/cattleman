const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite has no web implementation. On web it resolves to a shim with the
// same API, so every query and transaction above it is the real code.
const WEB_SHIMS = {
  'expo-sqlite': path.resolve(__dirname, 'src/db/sqlite.web.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_SHIMS[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
