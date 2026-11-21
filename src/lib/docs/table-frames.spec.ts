import { type Children, Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { specFor } from '@/config/versions'
import { apiArticle, apiKindArticle, cliArticle, glanceArticle } from '@/lib/docs/api-render'
import {
  apiKindParams,
  apiLayouts,
  apiModel,
  apiParams,
  cliParams,
  glanceParams,
  lineVersions,
} from '@/lib/docs/api-site'
import { cliCommand, cliManifest } from '@/lib/docs/cli-site'
import { glanceTopic } from '@/lib/docs/glance'
import { guideEnabled, guideEntries, guideView } from '@/lib/docs/guide-site'
import { guideArticle } from '@/lib/docs/render'
import { guidePage, linePages, lines } from '@/lib/docs/site'
import { guidePath } from '../../../scripts/lib/guide'

type Page = { path: string; markup: string }

const markupOf = (path: string, nodes: Children | undefined): Page[] =>
  nodes ? [{ path, markup: renderToStaticMarkup(Div({ children: nodes }).render()) }] : []

// The article of every page of a line that can draw a table: its guides, its API pages and their kinds'
// pages, its cheat sheets and its CLI, as the pages put them in Prose
const pagesOf = (line: string): Page[] => {
  const model = apiModel(line)
  const layouts = apiLayouts(line)
  const manifest = cliManifest(lineVersions(line)[0])
  return [
    ...(guideEnabled(line)
      ? guideEntries(line).flatMap(({ page }) => {
          const view = guideView(line, guidePath(page))
          return markupOf(`guide/${guidePath(page)}`, view && guideArticle(line, view))
        })
      : linePages(line).flatMap(({ path }) => markupOf(`guide/${path}`, guidePage(line, path)?.lowered.nodes))),
    ...apiParams()
      .filter(params => params.line === line)
      .flatMap(({ section, symbol }) => {
        const found = model?.symbol(section, symbol)
        return markupOf(`api/${section}/${symbol}`, found && apiArticle(found, layouts).nodes)
      }),
    ...apiKindParams()
      .filter(params => params.line === line)
      .flatMap(({ section }) => markupOf(`kind/${section}`, model && apiKindArticle(model, section)?.nodes)),
    ...glanceParams()
      .filter(params => params.line === line)
      .flatMap(({ topic }) => {
        const found = glanceTopic(topic)
        return markupOf(`glance/${topic}`, found && model && glanceArticle(line, model, found)?.nodes)
      }),
    ...cliParams()
      .filter(params => params.line === line && !params.version)
      .flatMap(({ command }) => {
        const found = manifest && cliCommand(manifest, command)
        return markupOf(`cli/${command}`, found && cliArticle(found, specFor(line)).nodes)
      }),
  ].map(page => ({ ...page, path: `${line}/${page.path}` }))
}

/** Every line's pages, rendered once for both tests. */
const pages = lines().flatMap(pagesOf)

const attribute = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1]

/** What is wrong with each table frame of a page, if anything: focus, role, and a name that resolves. */
function problems({ path, markup }: Page): string[] {
  return [...markup.matchAll(/<div [^>]*data-table="true"[^>]*>/g)].flatMap(([tag]) => {
    const found: string[] = []
    if (attribute(tag, 'tabindex') !== '0') found.push('not focusable')
    if (attribute(tag, 'role') !== 'region') found.push('not a region')
    const labelledBy = attribute(tag, 'aria-labelledby')
    const label = attribute(tag, 'aria-label')
    // A name with no letter or digit, such as the ", " of blank columns, says nothing
    if (labelledBy === undefined && !/[\p{L}\p{N}]/u.test(label ?? '')) found.push(`unnamed (${JSON.stringify(label)})`)
    if (labelledBy !== undefined && !markup.includes(` id="${labelledBy}"`)) found.push(`names #${labelledBy}, absent`)
    return found.map(problem => `${path}: ${problem}`)
  })
}

/** The text a frame is named by: its label, or the text of the element it names. */
function nameOf(markup: string, tag: string): string {
  const label = attribute(tag, 'aria-label')
  if (label !== undefined) return label
  const id = attribute(tag, 'aria-labelledby')
  const element = markup.match(new RegExp(`<(h[1-6]|p|div)[^>]* id="${id}"[^>]*>([\\s\\S]*?)</\\1>`))
  return (element?.[2] ?? '').replace(/<[^>]*>/g, '').trim()
}

/** Frames on one page that a screen reader would announce by the same name. */
function sameNames({ path, markup }: Page): string[] {
  const names = [...markup.matchAll(/<div [^>]*data-table="true"[^>]*>/g)].map(([tag]) => nameOf(markup, tag))
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))].map(
    name => `${path}: "${name}" × ${names.filter(each => each === name).length}`,
  )
}

// Renders every page of a line
const SWEEP_TIMEOUT_MS = 120_000

describe("a table's frame", { timeout: SWEEP_TIMEOUT_MS }, () => {
  it('takes focus and is a named region on every page, named by an element on the page', () => {
    const all = pages
    const framed = all.filter(page => page.markup.includes('data-table="true"'))

    // Guides, API parameters, the CLI's kind page, cheat sheets and the CLI all draw one
    for (const kind of ['/guide/', '/api/', '/kind/', '/glance/', '/cli/'])
      expect(framed.some(page => page.path.includes(kind))).toBe(true)
    expect(framed.some(page => page.markup.includes('data-params="true"'))).toBe(true)
    expect(framed.flatMap(problems)).toEqual([])
  })

  it('has a name no other frame on its page has', () => {
    expect(pages.flatMap(sameNames)).toEqual([])
  })
})
