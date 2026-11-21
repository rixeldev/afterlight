// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'dist-check/**', 'node_modules/**', 'docs/**', 'tools/**', 'android/**', 'ios/**', 'coverage/**'],
  },
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unknown-property': 'off',
      'import/no-unresolved': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
