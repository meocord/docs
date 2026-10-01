import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'

/**
 * Playwright's `test`, with a context that drops its routes, and those of every page it opened, as the test
 * ends. A route handler still running then, such as one awaiting `route.fetch()` for a page that is still
 * loading, rejects once the test is over, and Playwright reports that against whichever test the worker runs
 * next. Unrouting first keeps each test's handlers inside it. A spec that routes a request imports `test` from
 * here; scripts/lib/e2e-routes.spec.ts checks it does.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await use(context)
    await Promise.all(context.pages().map(page => page.unrouteAll({ behavior: 'ignoreErrors' })))
    await context.unrouteAll({ behavior: 'ignoreErrors' })
  },
})
