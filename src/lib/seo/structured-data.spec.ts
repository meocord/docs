import { describe, expect, it } from 'vitest'
import { breadcrumbList, framework, jsonLd, techArticle, website } from '@/lib/seo/structured-data'

describe('structured data', () => {
  it('lists a trail of crumbs, absolute, the page itself last and unlinked', () => {
    expect(breadcrumbList([{ title: '4.1', href: '/docs/latest' }, { title: 'Guards' }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '4.1', item: 'https://meocord.dev/docs/latest' },
        { '@type': 'ListItem', position: 2, name: 'Guards' },
      ],
    })
  })

  it('leaves out a crumb in the middle with no page of its own, so every item but the last has a URL', () => {
    const list = breadcrumbList([
      { title: '4.1', href: '/docs/latest' },
      { title: 'The request pipeline' },
      { title: 'Guards' },
    ])
    expect(list?.itemListElement).toEqual([
      expect.objectContaining({ position: 1, name: '4.1' }),
      { '@type': 'ListItem', position: 2, name: 'Guards' },
    ])
  })

  it('has no trail for a single crumb', () => {
    expect(breadcrumbList([{ title: 'Overview' }])).toBeUndefined()
  })

  it('describes a Guide page as an article of the site, at its canonical URL', () => {
    expect(
      techArticle({ title: 'Guards', description: 'Guard calls.', canonical: '/docs/latest/guards' }),
    ).toMatchObject({
      '@type': 'TechArticle',
      headline: 'Guards',
      description: 'Guard calls.',
      url: 'https://meocord.dev/docs/latest/guards',
      isPartOf: { '@type': 'WebSite', url: 'https://meocord.dev/' },
    })
  })

  it('describes the site and the framework for the home page', () => {
    expect(website('Bots.')).toMatchObject({ '@type': 'WebSite', name: 'MeoCord', url: 'https://meocord.dev/' })
    expect(framework('Bots.', 'https://github.com/meocord/meocord')).toMatchObject({
      '@type': 'SoftwareSourceCode',
      codeRepository: 'https://github.com/meocord/meocord',
    })
  })

  it('writes one node alone and several as a list, with no way to close its script', () => {
    expect(JSON.parse(jsonLd([website('a')]))).toMatchObject({ '@type': 'WebSite' })
    expect(JSON.parse(jsonLd([website('a'), website('b')]))).toHaveLength(2)
    const text = jsonLd([techArticle({ title: '</script><script>x()', description: '', canonical: '/' })])
    expect(text).not.toContain('</script>')
    expect(JSON.parse(text).headline).toBe('</script><script>x()')
  })
})
