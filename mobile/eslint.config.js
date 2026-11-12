// Lint config for the native app (separate from the website's config in the repo root).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([expoConfig, { ignores: ["dist/*", "android/*", "ios/*", ".expo/*"] }]);
