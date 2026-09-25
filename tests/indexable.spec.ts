import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

describe('once the site is indexable', () => {
  beforeAll(() => {
    vi.stubEnv('SITE_INDEXABLE', 'true')
    vi.resetModules()
  })
  afterAll(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('drops the noindex header and opens robots.txt and the sitemap', async () => {
    const { NextRequest } = await import('next/server')
    const { proxy } = await import('@/proxy')
    const { GET: robots } = await import('@/app/robots.txt/route')
    const { GET: sitemap } = await import('@/app/sitemap.xml/route')

    expect(proxy(new NextRequest('https://docs.test/')).headers.get('X-Robots-Tag')).toBeNull()
    const robotsResponse = robots()
    expect(robotsResponse.headers.get('X-Robots-Tag')).toBeNull()
    expect(await robotsResponse.text()).toContain('Sitemap: https://meocord.dev/sitemap.xml')
    expect(await sitemap().text()).toContain('<loc>https://meocord.dev/</loc>')
  })
})
