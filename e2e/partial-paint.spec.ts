import { expect, test } from '@playwright/test'
import { type Cut, cutServer, recordShifts } from './partial-paint'

/*
 * A page painted before all of it has arrived draws what it has; nothing the rest brings may move it.
 * Each page is cut at a few places a slow network could split it (in the toolbar, in the reading
 * column's first parts, in a component) and must arrive without a layout shift.
 */

const PAGES: { path: string; cuts: Cut[] }[] = [
  {
    path: '/',
    cuts: [
      { selector: '[data-search-trigger]', at: 'close' },
      { selector: '[data-sidebar-body]', at: 'open' },
      { selector: '[data-choose="member"]', at: 'close' },
    ],
  },
  {
    path: '/docs/4.1/guards',
    cuts: [
      { selector: '[data-search-trigger]', at: 'close' },
      { selector: 'h1', at: 'close' },
      { selector: 'figcaption', at: 'close' },
    ],
  },
  {
    path: '/docs/4.1/api/decorator/Command',
    cuts: [
      { selector: '[data-search-trigger]', at: 'close' },
      { selector: '[data-signature]', at: 'open' },
      { selector: '[data-params]', at: 'open' },
    ],
  },
]

const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const

for (const { path, cuts } of PAGES) {
  for (const cut of cuts) {
    for (const [label, viewport] of VIEWPORTS) {
      test(`${path} arrives cut ${cut.at === 'open' ? 'inside' : 'after'} ${cut.selector} without a shift, ${label}`, async ({
        page,
        baseURL,
      }) => {
        await page.setViewportSize(viewport)
        const served = await cutServer(baseURL!, path, cut)
        try {
          const shifts = await recordShifts(page)
          await page.goto(served.url, { waitUntil: 'load' })
          await expect(page.locator('footer')).toBeAttached()
          const { cls, moved } = await shifts()
          expect(cls, moved.join('; ')).toBe(0)
        } finally {
          await served.close()
        }
      })
    }
  }
}
