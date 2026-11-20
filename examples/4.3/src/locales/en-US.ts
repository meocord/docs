// #region catalog
import { defineCatalog } from 'meocord/common'

// The default catalog: every other locale is checked against it
export default defineCatalog({
  warn: { name: 'warn', description: 'Warn a member', done: 'Warned {user}.' },
  // One description for each kind of lookup, with the kind filled in
  lookup: { description: 'Look a {thing} up by name', things: { user: 'user', role: 'role' } },
  warnings: { one: '{user} has {count} warning', other: '{user} has {count} warnings' },
  // The label of the app's own message param type, in "is not a valid hex colour"
  types: { color: 'hex colour' },
})
// #endregion catalog
