const eslint = require('eslint/config');
const tseslint = require('typescript-eslint');

let customConfig = [];
let hasIgnoresFile = false;
try {
  require.resolve('./eslint.ignores.js');
  hasIgnoresFile = true;
} catch {
  // eslint.ignores.js doesn't exist
}

if (hasIgnoresFile) {
  const ignores = require('./eslint.ignores.js');
  customConfig = [
    {
      ignores,
    },
  ];
}

module.exports = eslint.defineConfig(
  customConfig,
  {
    extends: [require('gts')],
    rules: {
      'n/no-unpublished-import': ['error'],
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommendedTypeCheckedOnly],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
);
