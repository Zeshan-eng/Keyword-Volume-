import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', '**/node_modules/', 'coverage/', 'dist/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['extension/**/*.js'],
    ignores: ['extension/tests/**'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      // Prevent XSS sinks in extension UI code; build DOM with textContent instead.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent / DOM APIs.' },
        { property: 'outerHTML', message: 'Use textContent / DOM APIs.' },
        { property: 'insertAdjacentHTML', message: 'Use DOM APIs.' },
      ],
    },
  },
  {
    files: ['backend/**/*.js', 'extension/tests/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
