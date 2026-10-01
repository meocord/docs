import { expect, type Page, test } from '@playwright/test'

const term = (page: Page, id: string) => page.locator(`[data-sheet]:visible article p[data-term][id="${id}"]`)
const toolbarBottom = async (page: Page) => {
  const box = (await page.locator('[data-toolbar]:visible').boundingBox())!
  return box.y + box.height
}

test('gives every term on the glossary an anchor of its own', async ({ page }) => {
  await page.goto('/docs/4.1/glossary')
  const terms = page.locator('[data-sheet]:visible article p[data-term]')
  const ids = await terms.evaluateAll(nodes => nodes.map(node => node.id))
  // Every paragraph that opens with a bold term is one
  const defined = await page
    .locator('[data-sheet]:visible article p')
    .evaluateAll(
      nodes =>
        nodes.filter(node => /^\S.*\.$/.test(node.querySelector(':scope > strong:first-child')?.textContent ?? ''))
          .length,
    )
  expect(ids.length).toBe(defined)
  expect(ids.length).toBeGreaterThan(30)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).toEqual(expect.arrayContaining(['cooldown-store', 'customid-pattern', 'usererror']))
})

for (const width of [1440, 390]) {
  test(`a link to a term lands it below the toolbar, marked, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/docs/4.1/glossary#cooldown-store')
    const target = term(page, 'cooldown-store')
    await expect(target).toBeInViewport()
    await expect.poll(async () => (await target.boundingBox())!.y).toBeGreaterThanOrEqual(await toolbarBottom(page))
    expect(await target.evaluate(node => getComputedStyle(node, '::before').content)).toBe('""')
    // Another term, not the target, carries no mark
    expect(await term(page, 'usererror').evaluate(node => getComputedStyle(node, '::before').content)).toBe('none')
  })
}
