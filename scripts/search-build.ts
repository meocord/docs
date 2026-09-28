/**
 * Builds each line's search index and palette index from the committed content and generated data,
 * before `next build`. Output is derived, so it is not committed: a Pagefind bundle per line under
 * public/_pagefind/<line>.<hash>/, a palette index per line at public/palette/<line>.<hash>.json, and
 * .search/manifest.json naming them for the app. Each hash covers the bytes written, so a path
 * always names the same files and is safe to cache as immutable: Pagefind orders a filter's values
 * differently from run to run, so a hash of the inputs would not.
 */

import { createHash } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import * as pagefind from 'pagefind'
import semver from 'semver'
import type { ApiDocument } from './lib/api.js'
import type { ChangelogDocument } from './lib/changelog.js'
import { guideRendered, readGuide } from './lib/guide.js'
import { paths, ROOT } from './lib/layout.js'
import { listPages, loadPage, migratingGuide, resolveExample } from './lib/pages.js'
import {
  apiDocuments,
  changelogDocuments,
  cliDocuments,
  cliPaletteEntries,
  guideDocument,
  guidePageDocuments,
  migratingDocument,
  paletteIndex,
  searchHtml,
  type SearchDocument,
} from './lib/search.js'
import type { SinceEntry } from './lib/since.js'
import { readVersions } from './lib/versions.js'
import { apiArrangement, apiModel } from '../src/lib/docs/api-site.js'
import { cliHref, cliManifest } from '../src/lib/docs/cli-site.js'
import type { SearchManifest } from '../src/lib/search-manifest.js'

const PAGEFIND_DIR = path.join(ROOT, 'public', '_pagefind')
const PALETTE_DIR = path.join(ROOT, 'public', 'palette')
const MANIFEST = path.join(ROOT, '.search', 'manifest.json')

const readJson = <T>(file: string): T | undefined =>
  existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined

const hash = (...parts: (string | Buffer)[]) => {
  const digest = createHash('sha256')
  for (const part of parts) digest.update(part).update('\0')
  return digest.digest('hex').slice(0, 10)
}

/** The hash of every file under `dir`: their paths and bytes, in a stable order. */
const hashTree = (dir: string) => {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort()
  return hash(...files.flatMap(file => [file, readFileSync(path.join(dir, file))]))
}

const config = readVersions(paths.versions)
const since = readJson<Record<string, SinceEntry>>(paths.since) ?? {}

rmSync(PAGEFIND_DIR, { recursive: true, force: true })
rmSync(PALETTE_DIR, { recursive: true, force: true })
mkdirSync(PALETTE_DIR, { recursive: true })

const manifest: SearchManifest = { lines: [] }

for (const line of config.lines) {
  // A Guide page's examples as they stand at that page; a live page's as the finished files
  const examples =
    (page?: string) =>
    (file: string, region?: string): string | undefined => {
      try {
        return resolveExample(line.line, file, region, { root: ROOT, page })
      } catch {
        return undefined
      }
    }
  // A line whose Guide the site renders is searched by the Guide's pages, at their paths
  const guides = guideRendered(line.line)
    ? guidePageDocuments(line.line, readGuide(line.line, ROOT), config, examples)
    : listPages(line.line, { root: ROOT }).flatMap(entry => {
        const page = loadPage(line.line, entry.slug, { root: ROOT })
        return page ? [guideDocument(line.line, entry.slug, page, config, examples())] : []
      })

  const documents: SearchDocument[] = [...guides]
  const migrating = migratingGuide(line.line, { root: ROOT })
  if (migrating) documents.push(migratingDocument(line.line, migrating, config))

  const newestFirst = [...line.versions].sort(semver.rcompare)
  const changelogs = newestFirst.flatMap(version => readJson<ChangelogDocument>(paths.changelog(version)) ?? [])
  documents.push(...changelogDocuments(line.line, changelogs, config))

  // The line's API is its newest version's; exact versions stay out of search.
  const api = newestFirst.length > 0 ? readJson<ApiDocument>(paths.api(newestFirst[0])) : undefined
  // Each symbol's page as the site arranges the line's API: by entry point, or by kind
  const model = apiModel(line.line)
  const hrefOf = (entry: string, name: string) => {
    const location = model?.locate(entry, name)
    return location && model!.href(location)
  }
  if (api) documents.push(...apiDocuments(line.line, api, config, hrefOf))
  // The CLI's commands, where the line's API is arranged by kind and its newest version ships their manifest
  const cli = apiArrangement(line.line) === 'kind' ? cliManifest(newestFirst[0]) : undefined
  const cliHrefOf = (command: string, sub?: string) => cliHref(line.line, command, sub)
  if (cli) documents.push(...cliDocuments(line.line, cli, cliHrefOf))

  const pages = documents
    .map(document => ({ url: document.url, html: searchHtml(document, config) }))
    .sort((a, b) => a.url.localeCompare(b.url))
  const { index, errors } = await pagefind.createIndex({ forceLanguage: 'en' })
  if (!index) throw new Error(`Pagefind could not start for ${line.line}: ${errors.join('; ')}`)
  for (const page of pages) {
    const added = await index.addHTMLFile({ url: page.url, content: page.html })
    if (added.errors.length > 0) throw new Error(`Pagefind rejected ${page.url}: ${added.errors.join('; ')}`)
  }
  const staging = path.join(PAGEFIND_DIR, `.${line.line}`)
  const written = await index.writeFiles({ outputPath: staging })
  if (written.errors.length > 0) throw new Error(`Pagefind could not write ${line.line}: ${written.errors.join('; ')}`)
  await index.deleteIndex()
  const searchPath = `/_pagefind/${line.line}.${hashTree(staging)}/`
  renameSync(staging, path.join(ROOT, 'public', searchPath))

  const palette = JSON.stringify(
    paletteIndex(line.line, guides, api, since, config, hrefOf, cli ? cliPaletteEntries(cli, cliHrefOf) : []),
  )
  const palettePath = `/palette/${line.line}.${hash(palette)}.json`
  writeFileSync(path.join(ROOT, 'public', palettePath), `${palette}\n`)

  manifest.lines.push({
    line: line.line,
    status: line.status,
    search: searchPath,
    palette: palettePath,
    documents: pages.length,
  })
  console.log(`[search] ${line.line}: ${pages.length} documents -> ${searchPath}, palette ${palettePath}`)
}

await pagefind.close()
mkdirSync(path.dirname(MANIFEST), { recursive: true })
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`[search] manifest -> ${path.relative(ROOT, MANIFEST)}`)
