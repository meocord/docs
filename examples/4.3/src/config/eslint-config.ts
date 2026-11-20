// #region config
// eslint.config.ts

import meocordEslint, { typescriptConfig } from 'meocord/eslint'

export default [
  ...meocordEslint,
  {
    ...typescriptConfig,
    rules: {
      ...typescriptConfig.rules,
      // Your own rules, on top of MeoCord's
      'no-console': 'warn',
    },
  },
]
// #endregion config
