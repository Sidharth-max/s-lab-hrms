// Lint config for the native app (separate from the website's config in the repo root).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "android/*", "ios/*", ".expo/*"] },
  {
    // Tabler exposes one file per icon through package.json "exports" ("./*"), which Metro resolves
    // but eslint-plugin-import's resolver does not understand.
    rules: { "import/no-unresolved": ["error", { ignore: ["^@tabler/icons-react-native/"] }] },
  },
]);
