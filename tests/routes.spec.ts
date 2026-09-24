import { describe, expect, it } from 'vitest'
import { GET as robots } from '@/app/robots.txt/route'
import { GET as sitemap } from '@/app/sitemap.xml/route'
import { GET as og } from '@/app/og/[line]/[file]/route'

const card = (line: string, file: string) =>
  og(new Request('https://docs.test'), { params: Promise.resolve({ line, file }) })

describe('while the site is not indexable', () => {
  it('robots.txt disallows everything', async () => {
    const response = robots()
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  })

  it('the sitemap lists nothing', async () => {
    const response = sitemap()
    expect(await response.text()).not.toContain('<url>')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  })
})

describe('og route', () => {
  it('404s an unknown card, a malformed name and a stale hash, with the noindex header', async () => {
    for (const [line, file] of [
      ['site', 'missing.0123456789ab.png'],
      ['site', 'home.png'],
      ['site', 'home.0123456789ab.png'],
      ['4.9', 'home.0123456789ab.png'],
    ]) {
      const response = await card(line, file)
      expect(response.status, `${line}/${file}`).toBe(404)
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    }
  })
})
