/**
 * Fails when a built page, the search index or the palette tells a reader to create a project with a
 * package spec other than the one that installs that page's line. Run after `next build`.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import { gunzipSync } from 'zlib'
import { HOME_LINE } from '../src/config/home'
import { type BuiltText, commandProblems, htmlText } from './lib/built-commands.js'
import { paths, ROOT } from './lib/layout.js'
import { readVersions } from './lib/versions.js'

const filesUnder = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { recursive: true, encoding: 'utf8' }).map(file => path.join(dir, file)) : []

const texts: BuiltText[] = []

// Every prerendered page, at the URL it's served from
const app = path.join(ROOT, '.next', 'server', 'app')
for (const file of filesUnder(app).filter(name => name.endsWith('.html'))) {
  const route = path
    .relative(app, file)
    .replace(/\.html$/, '')
    .split(path.sep)
    .join('/')
  texts.push({
    file: path.relative(ROOT, file),
    url: route === 'index' ? '/' : `/${route}`,
    text: htmlText(readFileSync(file, 'utf8')),
  })
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
    text: [fragment.content, ...Object.values(fragment.meta ?? {})].join('\n'),
  })
}

// The palette's entries
for (const file of filesUnder(path.join(ROOT, 'public', 'palette')).filter(name => name.endsWith('.json'))) {
  const entries = JSON.parse(readFileSync(file, 'utf8')) as { name: string; url: string }[]
  for (const entry of entries) texts.push({ file: path.relative(ROOT, file), url: entry.url, text: entry.name })
}

if (!texts.some(text => text.file.endsWith('.html'))) {
  console.error('No built pages under .next/server/app: run the build first.')
  process.exit(1)
}
const problems = commandProblems(texts, readVersions(paths.versions), HOME_LINE)
if (problems.length > 0) {
  console.error(`${problems.length} create command(s) that don't install their page's line:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`Every create command in ${texts.length} built texts installs its page's line.`)
