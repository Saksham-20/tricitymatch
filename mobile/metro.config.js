const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch shared sources, resolve from both node_modules trees
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// @shared/* alias -> shared/src
config.resolver.extraNodeModules = {
  '@shared': path.resolve(monorepoRoot, 'shared', 'src'),
};

module.exports = config;
