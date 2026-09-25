/**
 * The rules the repository's content keeps: pages with an id and a title, examples that exist,
 * TypeScript only in typechecked example files, internal links and anchors that resolve, and
 * generated data for every version versions.json lists.
 */

import GithubSlugger from 'github-slugger'
import { parse as parseYaml } from 'yaml'
import type { ChangelogDocument } from './changelog'
import { CONFIG_REFERENCE_SLUG, configReferencePage, type ConfigDocument } from './config-reference'
import { changelogAnchor } from '../../src/lib/urls'
import { isKnownLanguage } from '../../src/lib/prose/languages'
import { markdownAnchors } from './migrating'
import { parseStored } from './stored-links'
import { newestIn, type VersionsConfig } from './versions'

export interface SiteSnapshot {
  config: VersionsConfig
  /** Authored pages per line, from content/<line>/, keyed by slug, as written on disk. */
  authored: Record<string, Record<string, string>>
  /** Pages imported from a README per line, from generated/readme/<line>/, keyed by slug. */
  readme: Record<string, Record<string, string>>
  readmeAnchors: Record<string, Record<string, string>>
  migrating: Record<string, string | undefined>
  changelogs: Record<string, ChangelogDocument | undefined>
  apis: Set<string>
  /** Each version's configuration reference, from generated/config/<version>.json. */
  configs: Record<string, ConfigDocument | undefined>
  /** Example files per line, keyed by their path under examples/<line>/. */
  examples: Record<string, Record<string, string>>
}

export interface Frontmatter {
  id?: string
  title?: string
  /** The sidebar group the page belongs to. */
  section?: string
  order?: number
  /** For a page imported from a README, `readme@<version>`. */
  source?: string
  /** The first version the page's topic exists in. */
  since?: string
  /** Ids the page had in earlier lines, so the version switcher lands on it from them. */
  formerly?: string[]
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

/** The language each opening code fence names, in order; an unmarked fence names none. */
export function fenceLanguages(markdown: string): string[] {
  const languages: string[] = []
  let fence: string | undefined
  for (const line of markdown.split('\n')) {
    const match = /^\s*(`{3,}|~{3,})\s*([^\s`{]*)/.exec(line)
    if (!match) continue
    if (!fence) {
      fence = match[1]
      if (match[2]) languages.push(match[2])
    } else if (match[1].startsWith(fence) && !match[2]) fence = undefined
  }
  return languages
}

const TYPESCRIPT_FENCE = /^\s*(`{3,}|~{3,})\s*(ts|typescript|tsx|mts|cts|js|javascript)\b/m
const EXAMPLE = /::example\{([^}]*)\}/g

/** The anchors of a page's headings, as GitHub and the site give them. */
export function pageAnchors(body: string): Set<string> {
  const slugger = new GithubSlugger()
  const anchors = new Set<string>()
  for (const line of withoutCode(body).split('\n')) {
    const heading = /^#{1,6} (.+?)\s*#*\s*$/.exec(line)
    if (heading) anchors.add(slugger.slug(heading[1]))
  }
  return anchors
}

type PageSet = 'authored' | 'readme'

const folder = (set: PageSet, line: string) => (set === 'authored' ? `content/${line}` : `generated/readme/${line}`)

export function checkSite(snapshot: SiteSnapshot): string[] {
  const problems: string[] = []
  const lines = new Map(snapshot.config.lines.map(line => [line.line, line]))
  // An authored line shows its newest version's configuration reference as one of its pages
  const authored = { ...snapshot.authored }
  for (const line of snapshot.config.lines) {
    const doc = snapshot.configs[newestIn(line)]
    if (line.guides !== 'authored' || !doc) continue
    if (authored[line.line]?.[CONFIG_REFERENCE_SLUG] !== undefined)
      problems.push(`content/${line.line}/${CONFIG_REFERENCE_SLUG}.md: the configuration reference is generated`)
    authored[line.line] = { ...authored[line.line], [CONFIG_REFERENCE_SLUG]: configReferencePage(line.line, doc) }
  }
  const site = { ...snapshot, authored }
  // The set the site shows for a line: its imported pages until its guides are authored
  const shown = (line: string): PageSet => (lines.get(line)?.guides === 'authored' ? 'authored' : 'readme')

  const anchorsOf = (set: PageSet, line: string, slug: string): Set<string> => {
    const text = site[set][line]?.[slug]
    const anchors = text ? pageAnchors(parsePage(text).body) : new Set<string>()
    if (set === 'readme')
      for (const [anchor, page] of Object.entries(site.readmeAnchors[line] ?? {}))
        if (page === slug) anchors.add(anchor)
    return anchors
  }

  /**
   * Checks a text's links. A link into the text's own line resolves in the text's own set, so pages
   * authored ahead of a line's switch link each other; any other link resolves in what the site shows.
   */
  const checkLinks = (
    where: string,
    markdown: string,
    from: { line: string; set: PageSet } | undefined,
    ownAnchors: () => Set<string>,
  ) => {
    for (const target of markdownLinks(markdown)) {
      if (target.startsWith('#')) {
        if (!ownAnchors().has(target.slice(1))) problems.push(`${where}: no heading for ${target}`)
        continue
      }
      if (!target.startsWith('/docs/') && target !== '/docs') {
        const relative = !/^[a-z][\w+.-]*:/i.test(target)
        if (relative && (target.startsWith('/') || /^\.\.?\//.test(target) || /\.md(#|$)/.test(target))) {
          problems.push(`${where}: ${target} does not point at a page of the site`)
        }
        continue
      }
      const parsed = parseStored(target, [...lines.keys()])
      if ('problem' in parsed) {
        problems.push(`${where}: ${target} ${parsed.problem}`)
        continue
      }
      const link = parsed.target
      const line = lines.get(link.line)!
      if (link.kind === 'line' || link.kind === 'api' || link.kind === 'missing') continue
      if (link.kind === 'changelog') {
        if (
          link.version !== undefined &&
          !line.versions.some(version => changelogAnchor(version) === `v${link.version}`)
        )
          problems.push(`${where}: ${target} names no version of ${link.line}`)
        continue
      }
      if (link.kind === 'migrating') {
        const guide = site.migrating[link.line]
        if (!guide) problems.push(`${where}: ${target} links a migration guide ${link.line} does not have`)
        else if (link.anchor && !markdownAnchors(guide).includes(link.anchor))
          problems.push(`${where}: ${target} names no heading of the migration guide`)
        continue
      }
      const set = from?.line === link.line ? from.set : shown(link.line)
      if (!site[set][link.line]?.[link.slug]) {
        problems.push(`${where}: ${target} names no page of ${folder(set, link.line)}`)
        continue
      }
      if (link.anchor && !anchorsOf(set, link.line, link.slug).has(link.anchor))
        problems.push(`${where}: ${target} names no heading of that page`)
    }
  }

  const checkPages = (set: PageSet, name: string) => {
    const ids = new Map<string, string>()
    for (const [slug, text] of Object.entries(site[set][name] ?? {})) {
      const where = `${folder(set, name)}/${slug}.md`
      const { frontmatter, body } = parsePage(text)
      if (!frontmatter.id) problems.push(`${where}: front matter has no id`)
      if (!frontmatter.title) problems.push(`${where}: front matter has no title`)
      if (frontmatter.id) {
        if (ids.has(frontmatter.id))
          problems.push(`${where}: id "${frontmatter.id}" is also used by ${ids.get(frontmatter.id)}`)
        ids.set(frontmatter.id, where)
      }
      for (const language of fenceLanguages(body))
        if (!isKnownLanguage(language))
          problems.push(`${where}: a code fence is marked "${language}", which the site does not highlight`)
      if (set === 'authored') {
        if (frontmatter.source?.startsWith('readme@'))
          problems.push(`${where}: a page imported from a README belongs in generated/readme/${name}`)
        if (TYPESCRIPT_FENCE.test(body) && !frontmatter.source?.startsWith('config@'))
          problems.push(`${where}: TypeScript belongs in examples/${name} and an ::example directive, not a code fence`)
      }

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
      checkLinks(where, body, { line: name, set }, () => anchorsOf(set, name, slug))
    }
  }

  for (const [name, line] of lines) {
    const readmePages = Object.keys(site.readme[name] ?? {}).length
    if (line.guides === 'readme') {
      if (readmePages === 0) problems.push(`generated/readme/${name} has no pages`)
      if (!site.readmeAnchors[name])
        problems.push(`line ${name} imports its README but has no generated/readme-anchors/${name}.json`)
    } else {
      if (Object.keys(snapshot.authored[name] ?? {}).length === 0) problems.push(`content/${name} has no pages`)
      if (readmePages > 0)
        problems.push(`generated/readme/${name} is still there, though ${name}'s guides are authored`)
    }
    checkPages('readme', name)
    checkPages('authored', name)

    const guide = site.migrating[name]
    if (guide) checkLinks(`generated/migrating/${name}.md`, guide, undefined, () => new Set(markdownAnchors(guide)))
    else if (line.versions.some(version => !site.config.provenance.integrityOnly.includes(version)))
      problems.push(`line ${name} has no generated/migrating/${name}.md`)
  }

  for (const line of site.config.lines) {
    for (const version of line.versions) {
      if (!site.apis.has(version)) problems.push(`${version} has no generated/api/${version}.json`)
      if (!site.configs[version]) problems.push(`${version} has no generated/config/${version}.json`)
      const changelog = site.changelogs[version]
      if (!changelog) {
        problems.push(`${version} has no generated/changelog/${version}.json`)
        continue
      }
      changelog.sections.forEach(section =>
        section.entries.forEach(entry =>
          checkLinks(`generated/changelog/${version}.json`, entry.markdown, undefined, () => new Set()),
        ),
      )
    }
  }
  return problems
}
