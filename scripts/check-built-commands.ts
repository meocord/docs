/**
 * Fails when a built page, the search index or the palette tells a reader to create a project with a
 * package spec other than the one that installs that page's line, or gives them a `meocord` command to
 * copy that a shell can't run; or when a built page's playground has no frame the build wrote. Run after
 * `next build`.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import { gunzipSync } from 'zlib'
import { HOME_LINE } from '../src/config/home'
import { type BuiltText, commandProblems, pageCode, pageText, searchText } from './lib/built-commands.js'
import { playgroundCount, playgroundProblems } from './lib/built-playground.js'
import type { CliCommand, CliManifest } from './lib/cli.js'
import { paths, ROOT } from './lib/layout.js'
import { readVersions } from './lib/versions.js'

const filesUnder = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { recursive: true, encoding: 'utf8' }).map(file => path.join(dir, file)) : []

const texts: BuiltText[] = []
const playgroundIssues: string[] = []
let playgrounds = 0

// Every prerendered page, at the URL it's served from
const app = path.join(ROOT, '.next', 'server', 'app')
for (const file of filesUnder(app).filter(name => name.endsWith('.html'))) {
  const route = path
    .relative(app, file)
    .replace(/\.html$/, '')
    .split(path.sep)
    .join('/')
  const url = route === 'index' ? '/' : `/${route}`
  const html = readFileSync(file, 'utf8')
  playgrounds += playgroundCount(html)
  playgroundIssues.push(...playgroundProblems(path.relative(ROOT, file), html, path.join(ROOT, 'public')))
  texts.push({ file: path.relative(ROOT, file), url, text: pageText(url, html), code: pageCode(url, html) })
}

// The search index's fragments, each the text of one page: gzipped JSON after Pagefind's signature
for (const file of filesUnder(path.join(ROOT, 'public', '_pagefind')).filter(name => name.endsWith('.pf_fragment'))) {
  const data = gunzipSync(readFileSync(file)).toString('utf8')
  const fragment = JSON.parse(data.slice(data.indexOf('{'))) as {
    url: string
    content: string
    meta?: Record<string, string>
  }
  texts.push({
    file: path.relative(ROOT, file),
    url: fragment.url,
    text: searchText(fragment.url, [fragment.content, ...Object.values(fragment.meta ?? {})].join('\n')),
  })
}

// The palette's entries
for (const file of filesUnder(path.join(ROOT, 'public', 'palette')).filter(name => name.endsWith('.json'))) {
  const entries = JSON.parse(readFileSync(file, 'utf8')) as { name: string; url: string }[]
  for (const entry of entries)
    texts.push({ file: path.relative(ROOT, file), url: entry.url, text: searchText(entry.url, entry.name) })
}

if (!texts.some(text => text.file.endsWith('.html'))) {
  console.error('No built pages under .next/server/app: run the build first.')
  process.exit(1)
}
// The CLI's commands and aliases, in every version that ships its manifest, and what prints its help or version
const commands = new Set(['help', '--help', '-h', '--version', '-V'])
const addCommands = (command: CliCommand) => {
  for (const name of [command.name, ...command.aliases]) commands.add(name)
}
for (const file of filesUnder(path.join(ROOT, 'generated', 'cli')).filter(name => name.endsWith('.json')))
  (JSON.parse(readFileSync(file, 'utf8')) as CliManifest).commands.forEach(addCommands)

const problems = [...commandProblems(texts, readVersions(paths.versions), HOME_LINE, commands), ...playgroundIssues]
if (problems.length > 0) {
  console.error(`${problems.length} problem(s) with the commands a reader gets or the playgrounds a page runs:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(
  `In ${texts.length} built texts, every create command installs its page's line and every copied command runs; ${playgrounds} playground(s) each name a frame the build wrote.`,
)
