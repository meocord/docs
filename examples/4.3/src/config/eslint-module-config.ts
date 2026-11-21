// #region config
// eslint.config.mjs

import meocordEslint from 'meocord/eslint'

// Typed rules read the tsconfig files beside this file, wherever ESLint runs from
const tsconfigRoot = {
  files: ['**/*.ts'],
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
}

export default [...meocordEslint, tsconfigRoot]
// #endregion config
