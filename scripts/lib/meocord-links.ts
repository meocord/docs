/**
 * The docs links meocord publishes: in its JSDoc, which editors show on hover, its README and changelog,
 * and the guides GitHub shows. Every `https://meocord.dev/docs/…` URL in a set of files, and whether each
 * resolves on a site.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

// A path that runs into an ellipsis is a placeholder, as in "https://meocord.dev/docs/4.1/…", not a link
const LINK = /https:\/\/meocord\.dev(\/docs\/[^\s)"'`*<>{}|\\…]+)(…)?/g

/** Each docs path the texts link, such as `/docs/4.1/guards#options`, once, in order. */
export function docsLinks(texts: string[]): string[] {
  const found = texts.flatMap(text =>
    [...text.matchAll(LINK)].flatMap(match => (match[2] ? [] : [match[1].replace(/[.,;:!?]+$/, '')])),
  )
  return [...new Set(found)].sort()
}

/** Every file under a folder whose name ends with one of `extensions`, node_modules aside; a file itself if it matches. */
export function filesUnder(target: string, extensions: string[]): string[] {
  if (!existsSync(target)) return []
  if (!statSync(target).isDirectory()) return extensions.some(extension => target.endsWith(extension)) ? [target] : []
  return readdirSync(target).flatMap(name =>
    name === 'node_modules' ? [] : filesUnder(path.join(target, name), extensions),
  )
}

/** The text of every file under a folder whose name ends with one of `extensions`, node_modules aside. */
export function textsUnder(dir: string, extensions: string[]): string[] {
  return filesUnder(dir, extensions).map(file => readFileSync(file, 'utf8'))
}

/**
 * Where a meocord checkout carries links its readers follow: the source and the declarations built from it,
 * the Markdown that ships to npm, and what GitHub shows: its guides, the changesets that become the
 * changelog, and its issue and pull request templates.
 */
export const PUBLISHED: { path: string; extensions: string[] }[] = [
  { path: 'src', extensions: ['.ts', '.template'] },
  { path: 'dist/types', extensions: ['.d.ts', '.d.cts'] },
  { path: 'README.md', extensions: ['.md'] },
  { path: 'CHANGELOG.md', extensions: ['.md'] },
  { path: 'CONTRIBUTING.md', extensions: ['.md'] },
  { path: 'docs', extensions: ['.md'] },
  { path: '.changeset', extensions: ['.md'] },
  { path: '.github', extensions: ['.md', '.yml'] },
]

/** Each docs path a checkout's published files link, with the files that link it, relative to the checkout. */
export function publishedLinks(checkout: string): Map<string, string[]> {
  const links = new Map<string, string[]>()
  for (const { path: target, extensions } of PUBLISHED)
    for (const file of filesUnder(path.join(checkout, target), extensions))
      for (const link of docsLinks([readFileSync(file, 'utf8')]))
        links.set(link, [...(links.get(link) ?? []), path.relative(checkout, file)])
  return new Map([...links].sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * Why a link does not resolve, given the final status and URL of a request for its path and the page
 * it answered with, or undefined when it does: the page answers 200, is not a line's page for a topic
 * it lacks, and has the heading it names.
 */
export function linkProblem(link: string, status: number, html: string, finalUrl = link): string | undefined {
  if (status !== 200) return `${link}: answered ${status}`
  if (new URL(finalUrl, 'https://meocord.dev').pathname.includes('/missing/'))
    return `${link}: its line has no such page (it lands on ${new URL(finalUrl, 'https://meocord.dev').pathname})`
  const anchor = link.includes('#') ? decodeURIComponent(link.slice(link.indexOf('#') + 1)) : undefined
  if (anchor && !html.includes(`id="${anchor}"`)) return `${link}: the page has no #${anchor}`
  return undefined
}
