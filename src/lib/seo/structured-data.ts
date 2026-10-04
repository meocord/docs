import { SITE_URL } from '@/config/site'
import type { Crumb } from '@/components/shell/types'

/** A schema.org node as JSON-LD, which search engines read for rich results. */
export type StructuredData = Record<string, unknown>

const absolute = (href: string) => new URL(href, SITE_URL).toString()

/**
 * The trail of crumbs as a BreadcrumbList: the linked ones and the page itself, last, since search engines need a URL
 * for every item but the last. Undefined with fewer than two, where there is no trail to show.
 */
export function breadcrumbList(crumbs: readonly Crumb[]): StructuredData | undefined {
  const trail = crumbs.filter((crumb, index) => crumb.href || index === crumbs.length - 1)
  if (trail.length < 2) return undefined
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.title,
      // The last crumb is the page itself, which the list may leave unlinked
      ...(crumb.href ? { item: absolute(crumb.href) } : {}),
    })),
  }
}

/** The site, for the home page. */
export function website(description: string): StructuredData {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: 'MeoCord', url: absolute('/'), description }
}

/** MeoCord itself, the framework the site documents, for the home page. */
export function framework(description: string, repository: string): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: 'MeoCord',
    description,
    url: absolute('/'),
    codeRepository: repository,
    programmingLanguage: 'TypeScript',
    runtimePlatform: 'Node.js',
    license: 'https://opensource.org/licenses/MIT',
  }
}

/** A Guide page as an article of the site. */
export function techArticle(page: { title: string; description: string; canonical: string }): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.title,
    description: page.description,
    url: absolute(page.canonical),
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'MeoCord', url: absolute('/') },
  }
}

/** JSON-LD as a script's text: `<` escaped, so no value can close the script it sits in. */
export function jsonLd(data: readonly StructuredData[]): string {
  return JSON.stringify(data.length === 1 ? data[0] : data).replace(/</g, '\\u003c')
}
