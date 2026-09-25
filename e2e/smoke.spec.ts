import { expect, test, type APIRequestContext } from '@playwright/test'

const NOINDEX = 'noindex, nofollow'

async function headersOf(request: APIRequestContext, path: string) {
  const response = await request.get(path, { maxRedirects: 0 })
  return { status: response.status(), headers: response.headers() }
}

test('every surface is noindexed while the site is not indexable', async ({ page, request }) => {
  await page.goto('/')
  const asset = await page.locator('script[src^="/_next/static/"]').first().getAttribute('src')
  const og = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(asset).toBeTruthy()
  expect(og).toMatch(/\/og\/site\/home\.[0-9a-f]{12}\.png$/)

  for (const path of [
    '/',
    asset!,
    new URL(og!).pathname,
    '/robots.txt',
    '/sitemap.xml',
    '/api/health',
    '/icon-32.png',
  ]) {
    const { status, headers } = await headersOf(request, path)
    expect(status, path).toBe(200)
    expect(headers['x-robots-tag'], path).toBe(NOINDEX)
  }
})

test('the home page runs under its CSP with no violation', async ({ page }) => {
  const violations: string[] = []
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) violations.push(message.text())
  })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      console.error(`Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`)
    })
  })

  const response = await page.goto('/')
  // The header keeps every directive; the inline scripts' hashes are in a meta tag, first in <head>.
  const csp = response?.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("frame-ancestors 'self'")
  expect(csp).not.toContain('__CSP_HASHES__')
  const meta = page.locator('head > meta[http-equiv="Content-Security-Policy"]')
  await expect(meta).toHaveAttribute('content', /^script-src 'self'.*( 'sha256-[^']+')+$/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/)
  await expect(page.getByRole('heading', { name: 'MeoCord', exact: true })).toBeVisible()
  expect(violations).toEqual([])
})

test('a reload answered 304 keeps the cached page running under its policy', async ({ page }) => {
  const problems: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') problems.push(message.text())
  })
  page.on('pageerror', error => problems.push(error.message))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      console.error(`Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`)
    })
  })

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/)
  const reload = await page.reload()
  // The scenario only holds if the browser revalidated; the browser reports the reused response as 200.
  expect((await reload!.request().allHeaders())['if-none-match']).toBeTruthy()
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/)
  expect(problems).toEqual([])
})

test('a 304 carries no policy, so the cached one stays in force', async ({ request }) => {
  const first = await request.get('/')
  const etag = first.headers()['etag']
  expect(etag).toBeTruthy()
  const revalidated = await request.get('/', { headers: { 'if-none-match': etag } })
  expect(revalidated.status()).toBe(304)
  expect(revalidated.headers()['content-security-policy']).toBeUndefined()
  expect(revalidated.headers()['x-robots-tag']).toBe(NOINDEX)
})

test('the same page is byte-identical for every reader', async ({ request }) => {
  const first = await (await request.get('/')).text()
  const second = await (await request.get('/', { headers: { cookie: 'theme=light' } })).text()
  expect(second).toBe(first)
})

test('next is a 307 to the prerelease line, with the site headers', async ({ request }) => {
  const { status, headers } = await headersOf(request, '/docs/next/intro')
  expect(status).toBe(307)
  expect(headers.location).toMatch(/\/docs\/\d+\.\d+\/intro$/)
  expect(headers['x-robots-tag']).toBe(NOINDEX)
})

test('an OG card says which engine drew it', async ({ page, request }) => {
  await page.goto('/')
  const og = await page.locator('meta[property="og:image"]').getAttribute('content')
  const response = await request.get(new URL(og!).pathname)
  expect(response.headers()['content-type']).toBe('image/png')
  expect(response.headers()['x-rasteriser']).toMatch(/^(gpu|cpu)$/)
})

test('an OG card under a stale hash is a 404', async ({ request }) => {
  const { status } = await headersOf(request, '/og/site/home.000000000000.png')
  expect(status).toBe(404)
})

test('health reports the runtime and is never cached', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.headers()['cache-control']).toBe('no-store')
  expect(await response.json()).toMatchObject({ status: 'ok', runtime: expect.stringMatching(/^bun /) })
})

test('the reading face is preloaded from the site itself', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="preload"][as="font"]').first().getAttribute('href')
  expect(href).toMatch(/^\/_next\/static\/media\/.+\.woff2$/)
  const response = await request.get(href!)
  expect(response.status()).toBe(200)
  // The body's face loads from that file rather than falling back.
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready
    const family = getComputedStyle(document.body).fontFamily.split(',')[0].trim()
    return document.fonts.check(`16px ${family}`) && [...document.fonts].some(face => face.status === 'loaded')
  })
  expect(loaded).toBe(true)
})

test('the palette follows the stamped mode', async ({ page }) => {
  await page.goto('/')
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  expect(await background()).toBe('rgb(22, 22, 24)')
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  expect(await background()).toBe('rgb(242, 242, 244)')
})
