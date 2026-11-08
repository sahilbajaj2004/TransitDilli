const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support bundling .db files as assets for expo-sqlite
if (!config.resolver.assetExts.includes('db')) {
  config.resolver.assetExts.push('db');
}

module.exports = config;
