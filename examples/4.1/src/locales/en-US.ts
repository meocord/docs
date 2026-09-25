// #region catalog
import { defineCatalog } from 'meocord/common'

// The default catalog: every other locale is checked against it
export default defineCatalog({
  warn: { name: 'warn', description: 'Warn a member', done: 'Warned {user}.' },
  warnings: { one: '{user} has {count} warning', other: '{user} has {count} warnings' },
})
// #endregion catalog
