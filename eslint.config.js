// ESLint flat config (ESLint 9+). ESM, because package.json has "type": "module".
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Don't lint build output or private notes (node_modules is ignored by default).
  { ignores: ['dist', 'notes'] },

  // Basic ESLint rules.
  eslint.configs.recommended,

  // Parser + type-aware TypeScript rules (catches floating promises, unsafe any, ...).
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // This config file is plain JS, not in the TS project — skip type-aware rules.
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
