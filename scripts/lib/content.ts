/**
 * The rules the repository's content keeps: pages with an id and a title, examples that exist,
 * TypeScript only in typechecked example files, internal links and anchors that resolve, and
 * generated data for every version versions.json lists.
 */

import GithubSlugger from 'github-slugger'
import { parse as parseYaml } from 'yaml'
import type { ChangelogDocument } from './changelog.js'
import { markdownAnchors } from './migrating.js'
import type { VersionsConfig } from './versions.js'

export interface SiteSnapshot {
  config: VersionsConfig
  /** Page files per line, keyed by slug, as written on disk. */
  pages: Record<string, Record<string, string>>
  readmeAnchors: Record<string, Record<string, string>>
  migrating: Record<string, string | undefined>
  changelogs: Record<string, ChangelogDocument | undefined>
  apis: Set<string>
  /** Example files per line, keyed by their path under examples/<line>/. */
  examples: Record<string, Record<string, string>>
}

export interface Frontmatter {
  id?: string
  title?: string
  order?: number
  source?: string
}

export function parsePage(text: string): { frontmatter: Frontmatter; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) return { frontmatter: {}, body: text }
  return { frontmatter: (parseYaml(match[1]) ?? {}) as Frontmatter, body: text.slice(match[0].length) }
}

/** Markdown with fenced and inline code blanked out, so links and directives inside code are not read. */
export function withoutCode(markdown: string): string {
  let fence: string | undefined
  return markdown
    .split('\n')
    .map(line => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
      if (marker && (!fence || marker.startsWith(fence))) {
        fence = fence ? undefined : marker
        return ''
      }
      return fence ? '' : line.replace(/`[^`\n]*`/g, '')
    })
    .join('\n')
}

export function markdownLinks(markdown: string): string[] {
  return [...withoutCode(markdown).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(match => match[1])
}

const TYPESCRIPT_FENCE = /^\s*(`{3,}|~{3,})\s*(ts|typescript|tsx|mts|cts|js|javascript)\b/m
const EXAMPLE = /::example\{([^}]*)\}/g

function pageAnchors(body: string): Set<string> {
  const slugger = new GithubSlugger()
  const anchors = new Set<string>()
  for (const line of withoutCode(body).split('\n')) {
    const heading = /^#{1,6} (.+?)\s*#*\s*$/.exec(line)
    if (heading) anchors.add(slugger.slug(heading[1]))
  }
  return anchors
}

export function checkSite(site: SiteSnapshot): string[] {
  const problems: string[] = []
  const lines = new Map(site.config.lines.map(line => [line.line, line]))
  const aliasTargets: Record<string, string | undefined> = {
    latest: site.config.lines.find(line => line.status === 'current')?.line,
    next: site.config.lines.find(line => line.status === 'prerelease')?.line,
  }

  const anchorsOf = (line: string, slug: string): Set<string> => {
    const text = site.pages[line]?.[slug]
    const anchors = text ? pageAnchors(parsePage(text).body) : new Set<string>()
    for (const [anchor, page] of Object.entries(site.readmeAnchors[line] ?? {})) if (page === slug) anchors.add(anchor)
    return anchors
  }

  const checkLinks = (where: string, markdown: string, ownAnchors: () => Set<string>) => {
    for (const target of markdownLinks(markdown)) {
      if (target.startsWith('#')) {
        if (!ownAnchors().has(target.slice(1))) problems.push(`${where}: no heading for ${target}`)
        continue
      }
      const internal = /^\/docs\/([^/#]+)(?:\/([^#]*))?(?:#(.+))?$/.exec(target)
      if (!internal) {
        const relative = !/^[a-z][\w+.-]*:/i.test(target)
        if (relative && (target.startsWith('/') || /^\.\.?\//.test(target) || /\.md(#|$)/.test(target))) {
          problems.push(`${where}: ${target} does not point at a page of the site`)
        }
        continue
      }
      const [, version, page = '', anchor] = internal
      const targetLine = aliasTargets[version] ?? version
      if (!lines.has(targetLine)) {
        problems.push(`${where}: ${target} names a version the site does not document`)
        continue
      }
      if (page === '' || page.startsWith('api')) continue
      if (page === 'changelog') {
        if (anchor && !lines.get(targetLine)!.versions.includes(anchor))
          problems.push(`${where}: ${target} names no version of ${targetLine}`)
        continue
      }
      if (page === 'migrating') {
        const guide = site.migrating[targetLine]
        if (!guide) problems.push(`${where}: ${target} links a migration guide ${targetLine} does not have`)
        else if (anchor && !markdownAnchors(guide).includes(anchor))
          problems.push(`${where}: ${target} names no heading of the migration guide`)
        continue
      }
      if (!site.pages[targetLine]?.[page]) {
        problems.push(`${where}: ${target} names no page of ${targetLine}`)
        continue
      }
      if (anchor && !anchorsOf(targetLine, page).has(anchor))
        problems.push(`${where}: ${target} names no heading of that page`)
    }
  }

  for (const [name, line] of lines) {
    const pages = site.pages[name] ?? {}
    if (Object.keys(pages).length === 0) problems.push(`content/${name} has no pages`)
    if (line.guides === 'readme' && !site.readmeAnchors[name])
      problems.push(`line ${name} imports its README but has no generated/readme-anchors/${name}.json`)

    const ids = new Map<string, string>()
    for (const [slug, text] of Object.entries(pages)) {
      const where = `content/${name}/${slug}.md`
      const { frontmatter, body } = parsePage(text)
      if (!frontmatter.id) problems.push(`${where}: front matter has no id`)
      if (!frontmatter.title) problems.push(`${where}: front matter has no title`)
      if (frontmatter.id) {
        if (ids.has(frontmatter.id))
          problems.push(`${where}: id "${frontmatter.id}" is also used by ${ids.get(frontmatter.id)}`)
        ids.set(frontmatter.id, where)
      }
      const imported = frontmatter.source?.startsWith('readme@') ?? false
      if (!imported && TYPESCRIPT_FENCE.test(body))
        problems.push(`${where}: TypeScript belongs in examples/${name} and an ::example directive, not a code fence`)

      for (const match of withoutCode(body).matchAll(EXAMPLE)) {
        const attributes = Object.fromEntries(
          [...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
        )
        const source = attributes.file ? site.examples[name]?.[`src/${attributes.file}`] : undefined
        if (!attributes.file) problems.push(`${where}: an ::example names no file`)
        else if (source === undefined) problems.push(`${where}: examples/${name}/src/${attributes.file} does not exist`)
        else if (
          attributes.region &&
          !(
            source.includes(`// #region ${attributes.region}\n`) &&
            source.includes(`// #endregion ${attributes.region}`)
          )
        ) {
          problems.push(`${where}: examples/${name}/src/${attributes.file} has no region "${attributes.region}"`)
        }
      }
      checkLinks(where, body, () => anchorsOf(name, slug))
    }

    const guide = site.migrating[name]
    if (guide) checkLinks(`generated/migrating/${name}.md`, guide, () => new Set(markdownAnchors(guide)))
    else if (line.versions.some(version => !site.config.provenance.integrityOnly.includes(version)))
      problems.push(`line ${name} has no generated/migrating/${name}.md`)
  }

  for (const line of site.config.lines) {
    for (const version of line.versions) {
      if (!site.apis.has(version)) problems.push(`${version} has no generated/api/${version}.json`)
      const changelog = site.changelogs[version]
      if (!changelog) {
        problems.push(`${version} has no generated/changelog/${version}.json`)
        continue
      }
      changelog.sections.forEach(section =>
        section.entries.forEach(entry =>
          checkLinks(`generated/changelog/${version}.json`, entry.markdown, () => new Set()),
        ),
      )
    }
  }
  return problems
}
