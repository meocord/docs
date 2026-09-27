/**
 * The docs links meocord ships in its JSDoc, which editors show on hover: every
 * `https://meocord.dev/docs/…` URL in a set of files, and whether each resolves on a site.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const LINK = /https:\/\/meocord\.dev(\/docs\/[^\s)"'`*<>{}|\\]+)/g

/** Each docs path the texts link, such as `/docs/4.1/guards#options`, once, in order. */
export function docsLinks(texts: string[]): string[] {
  const found = texts.flatMap(text => [...text.matchAll(LINK)].map(match => match[1].replace(/[.,;:!?]+$/, '')))
  return [...new Set(found)].sort()
}

/** The text of every file under a folder whose name ends with one of `extensions`, node_modules aside. */
export function textsUnder(dir: string, extensions: string[]): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    if (name === 'node_modules') return []
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return textsUnder(full, extensions)
    return extensions.some(extension => name.endsWith(extension)) ? [readFileSync(full, 'utf8')] : []
  })
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
