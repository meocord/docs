/**
 * Fails when a prerendered page's first-load JavaScript is over budget. Run after `bun run build`;
 * it reads the pages Next wrote to .next/server/app and the chunks in .next/static.
 */

import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { measure, report } from './lib/js-budget.js'

const root = process.cwd()
const app = path.join(root, '.next', 'server', 'app')
const pages: Record<string, string> = {}
for (const file of readdirSync(app, { recursive: true, encoding: 'utf8' })) {
  if (!file.endsWith('.html')) continue
  const route = `/${file.slice(0, -'.html'.length)}`.replace(/\/index$/, '') || '/'
  pages[route] = readFileSync(path.join(app, file), 'utf8')
}
if (Object.keys(pages).length === 0) {
  console.error('No prerendered pages under .next/server/app: run `bun run build` first.')
  process.exit(1)
}

const results = measure(pages, src => readFileSync(path.join(root, '.next', src.replace(/^\/_next\//, ''))))
const { text, over } = report(results)
console.log(text)
if (over.length > 0) {
  console.error(`\n${over.length} page(s) over the first-load JS budget.`)
  process.exit(1)
}
