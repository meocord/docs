import { expect, test } from '@playwright/test'
import { cutServer, recordShifts } from './partial-paint'

test('the panel paints the finished run without any script', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await expect(panel.locator('[data-stage][data-state="done"]')).toHaveCount(7)
  await expect(panel.locator('[data-reply="member"]')).toBeVisible()
  await expect(panel.locator('[data-reply="member"]')).toContainText('Hello, Ada!')
  await expect(panel.locator('[data-pane="code"] code')).toContainText(
    'async greet(interaction: ChatInputCommandInteraction',
  )
  await context.close()
})

test('Run takes a member’s call through every stage to the reply', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-run]').click()
  await expect(panel).not.toHaveAttribute('data-answered')
  await expect(panel.locator('[data-reply="thinking"]')).toBeVisible()
  await expect(panel).toHaveAttribute('data-answered', '', { timeout: 6000 })
  await expect(panel.locator('[data-reply="member"]')).toContainText('Hello, Ada!')
  await expect(panel.locator('[data-stage][data-state="done"]')).toHaveCount(7)
  await expect(panel.locator('[data-pane="code"] .line[data-lit]')).toContainText('respond(interaction)')
})

test('a blocked user’s call stops at the guard, with its reason', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-choose="blocked"]').click()
  await expect(panel.locator('[data-stage="guard"]')).toHaveAttribute('data-state', 'stopped', { timeout: 6000 })
  await expect(panel.locator('[data-choose="blocked"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.locator('[data-stage="pipe"]')).toHaveAttribute('data-state', 'skipped')
  await expect(panel.locator('[data-reply="blocked"]')).toContainText('This command is for members.')
  await expect(panel.locator('[data-reply="member"]')).toBeHidden()
  await expect(panel.locator('[data-pane="code"] .line[data-lit="stopped"]')).toContainText('@UseGuard(MemberGuard)')
})

test('a control pressed while the player loads still acts', async ({ page }) => {
  // Hold the player's chunk until the press has happened.
  let release = () => {}
  const held = new Promise<void>(resolve => (release = resolve))
  let holding = () => {}
  const reached = new Promise<void>(resolve => (holding = resolve))
  await page.route('**/_next/static/chunks/*.js', async route => {
    const response = await route.fetch()
    const body = await response.text()
    if (body.includes('narrationText')) {
      holding()
      await held
    }
    await route.fulfill({ response, body })
  })
  await page.goto('/')
  await reached
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-choose="blocked"]').click()
  release()
  await expect(panel.locator('[data-stage="guard"]')).toHaveAttribute('data-state', 'stopped', { timeout: 6000 })
})

test('Step moves one stage at a time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-step]').click()
  await expect(panel.locator('[data-stage="defer"]')).toHaveAttribute('data-state', 'current')
  await expect(panel.locator('[data-narration]')).toContainText('three seconds')
  await panel.locator('[data-step]').click()
  await expect(panel.locator('[data-stage="guard"]')).toHaveAttribute('data-state', 'current')
  await expect(panel.locator('[data-stage="defer"]')).toHaveAttribute('data-state', 'done')
})

test('with reduced motion, Run reaches the reply at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-run]').click()
  await expect(panel).toHaveAttribute('data-answered', '', { timeout: 500 })
})

for (const scheme of ['light', 'dark'] as const) {
  test(`stages not yet run stay readable in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('/')
    const panel = page.locator('[data-pipeline]')
    await panel.locator('[data-step]').click()
    await expect(panel.locator('[data-stage][data-state="pending"]')).toHaveCount(6)
    // The lowest contrast among the pending stages' visible text, against what is painted behind it.
    const lowest = await panel.evaluate(root => {
      const rgba = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number)
      const luminance = ([r, g, b]: number[]) => {
        const channel = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
      }
      const backdrop = (el: Element) => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          const [r, g, b, a = 1] = rgba(getComputedStyle(node).backgroundColor)
          if (a === 1) return [r, g, b]
        }
        return [255, 255, 255]
      }
      let min = Infinity
      for (const el of root.querySelectorAll(
        '[data-state="pending"] [data-stage-name], [data-state="pending"] [data-for]',
      )) {
        if (!(el as HTMLElement).offsetParent) continue
        let opacity = 1
        for (let node: Element | null = el; node; node = node.parentElement)
          opacity *= Number(getComputedStyle(node).opacity)
        const back = backdrop(el)
        const [r, g, b, a = 1] = rgba(getComputedStyle(el).color)
        const alpha = a * opacity
        const fore = [r, g, b].map((c, i) => c * alpha + back[i] * (1 - alpha))
        const [hi, lo] = [luminance(fore), luminance(back)].sort((x, y) => y - x)
        min = Math.min(min, (hi + 0.05) / (lo + 0.05))
      }
      return min
    })
    expect(lowest).toBeGreaterThanOrEqual(4.5)
  })
}

for (const width of [1440, 2560]) {
  test(`every row's code reads whole, without sideways scrolling, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const hidden = await page
      .locator('[data-row] [data-code] pre')
      .evaluateAll(pres => pres.map(pre => pre.scrollWidth - pre.clientWidth))
    expect(hidden.length).toBeGreaterThan(4)
    expect(hidden.every(width => width === 0)).toBe(true)
  })
}

test('copying a row’s wrapped code keeps its lines, blank ones too', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const frame = page.locator('section[aria-labelledby="features"] [data-code]').nth(2)
  await frame.locator('[data-copy]').click()
  const source = (await frame.locator('pre code').textContent())!.replace(/\n$/, '')
  expect(source).toContain('\n\n')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source)
})

const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const

for (const [label, viewport] of VIEWPORTS) {
  for (const cut of [
    { selector: '[data-bar] h2', at: 'close' },
    { selector: '[data-choose="member"]', at: 'close' },
    { selector: '[data-step]', at: 'close' },
  ] as const) {
    test(`the panel's bar keeps each control where it stays when the page arrives cut after ${cut.selector}, ${label}`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize(viewport)
      const served = await cutServer(baseURL!, '/', cut)
      try {
        const shifts = await recordShifts(page)
        await page.goto(served.url, { waitUntil: 'load' })
        await expect(page.locator('[data-run]')).toBeVisible()
        const { cls, moved } = await shifts()
        expect(cls, moved.join('; ')).toBe(0)
      } finally {
        await served.close()
      }
    })
  }

  test(`each control of the panel's bar still fits the column kept for it, ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    const fits = await page.locator('[data-bar]').evaluate(bar => {
      const style = getComputedStyle(bar)
      const kept = (name: string) => parseFloat(style.getPropertyValue(name))
      const width = (selector: string) => bar.querySelector(selector)!.getBoundingClientRect().width
      return [
        ['choose', width('[data-segments]'), kept('--bar-choose')],
        ['step', width('[data-step]'), kept('--bar-step')],
        ['run', width('[data-run]'), kept('--bar-run')],
      ].map(([control, content, column]) => ({
        control,
        fits: (content as number) <= (column as number),
        content,
        column,
      }))
    })
    // A wider label, weight or face would widen its column as it arrived and move what follows.
    for (const control of fits) expect(control, JSON.stringify(control)).toMatchObject({ fits: true })
  })
}

// The sections below the pipeline panel are drawn only as the reader nears them (content-visibility).
test.describe('the sections below the panel, drawn as the reader nears them', () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`a link to #features or #testing lands on its heading, at ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      for (const id of ['features', 'testing']) {
        await page.goto(`/#${id}`)
        const heading = page.locator(`h2#${id}`)
        await expect(heading).toBeInViewport()
        // At the top of the view, below the toolbar, not merely somewhere on screen.
        await expect.poll(async () => (await heading.boundingBox())?.y ?? Infinity).toBeLessThan(200)
      }
    })
  }

  test('their text stays in the accessibility tree and within reach of find-in-page', async ({ page }) => {
    await page.goto('/')
    // Every section below the panel is drawn on demand; the panel itself is not.
    const visibility = await page.evaluate(() =>
      [...document.querySelectorAll('main section[aria-labelledby]')].map(section => [
        section.getAttribute('aria-labelledby'),
        getComputedStyle(section).contentVisibility,
      ]),
    )
    expect(visibility).toEqual([
      ['pipeline-title', 'visible'],
      ['why', 'auto'],
      ['features', 'auto'],
      ['start', 'auto'],
      ['testing', 'auto'],
      ['new', 'auto'],
    ])
    await expect(page.getByRole('heading', { level: 2, name: 'Tested the way it runs' })).toBeAttached()
    await expect(page.locator('section[aria-labelledby="testing"]')).not.toBeInViewport()
    // The browser's own find matches text it has not drawn yet: the match is the section's heading.
    const found = await page.evaluate(() => {
      const hit = (window as unknown as { find(text: string): boolean }).find('Tested the way it runs')
      return hit ? (window.getSelection()?.anchorNode?.parentElement?.closest('h2')?.id ?? null) : null
    })
    expect(found).toBe('testing')
  })
})
