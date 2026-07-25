import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'

// Flat config for the Vue 3 frontend (plain JS, <script setup>). Kept lean and
// correctness-focused (Vue "essential" + a few core rules) so it flags real
// problems without imposing a repo-wide style rewrite.
export default [
  // Never lint build output / deps / coverage.
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      // Unused caught errors / args are an accepted pattern here (catch (e) {}).
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', vars: 'all' }],
      'no-undef': 'error',
      // Keep flagging bare constant loop conditions (the api.js retry loop opts
      // out explicitly via an eslint-disable-next-line comment).
      'no-constant-condition': ['error', { checkLoops: true }],
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // Test files: Vitest globals are imported explicitly, but allow node + jsdom.
    files: ['**/*.{test,spec}.{js,mjs}', 'test/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
]
