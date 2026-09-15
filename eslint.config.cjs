const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([expo,
  { ignores: ['dist/**', 'ios/**', 'android/**', 'artifacts/**', 'assets/**', '.tooling/**'] },
  { files: ['*.cjs', 'plugins/*.cjs'], languageOptions: { globals: { __dirname: 'readonly' } } },
  // Metro requires static require() calls for bundled native assets.
  { files: ['src/services/model.ts', 'src/ui/fonts.ts'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
]);
