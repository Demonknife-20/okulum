import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'data/**', 'test/e2e/**'] },
  js.configs.recommended,
  {
    files: ['public/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['src/**/*.js', 'server.js', 'scripts/**/*.mjs', 'scripts/**/*.js', 'test/**/*.js', 'test/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module' },
  },
  {
    files: ['test/**/*.mjs', 'public/**/*.js'],
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
];
