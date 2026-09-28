/**
 * Records the docs URLs a deployed build answers, so a later build can be checked to still answer each one:
 * every page its prerender manifest lists, the same pages under `latest` and `next`, its redirects with where
 * each went, and each authored page's id, which a page that replaces it names in `formerly` or `covers`. Run it on a build of the deployed commit:
 *
 *   bun scripts/live-routes.ts <checkout of that commit, built>
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parsePage } from './lib/content'
import { paths } from './lib/layout'
import type { LiveRoutes } from './lib/live-routes'
import type { VersionsConfig } from './lib/versions'

const checkout = process.argv[2]
if (!checkout) throw new Error('usage: bun scripts/live-routes.ts <built checkout of the deployed commit>')

const commit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const config = JSON.parse(readFileSync(path.join(checkout, 'versions.json'), 'utf8')) as VersionsConfig
const manifest = JSON.parse(readFileSync(path.join(checkout, '.next', 'prerender-manifest.json'), 'utf8')) as {
  routes: Record<string, unknown>
}
const routesManifest = JSON.parse(readFileSync(path.join(checkout, '.next', 'routes-manifest.json'), 'utf8')) as {
  redirects: { source: string; destination: string; internal?: boolean }[]
}

const pages = Object.keys(manifest.routes).filter(route => route === '/' || route.startsWith('/docs/'))
// `latest` serves the current line, and `next` sends the prerelease line's readers on
const aliases = [
  ['latest', config.lines.find(line => line.status === 'current')?.line],
  ['next', config.lines.find(line => line.status === 'prerelease')?.line],
] as const
const aliased = aliases.flatMap(([alias, line]) =>
  line
    ? pages
        .filter(route => route === `/docs/${line}` || route.startsWith(`/docs/${line}/`))
        .map(route => `/docs/${alias}${route.slice(`/docs/${line}`.length)}`)
    : [],
)

// The site's own redirects, Next's trailing-slash one aside; `next` reaches the prerelease line's through its 307
const prerelease = aliases.find(([alias]) => alias === 'next')?.[1]
const redirects = routesManifest.redirects
  .filter(redirect => !redirect.internal)
  .flatMap(({ source, destination }) => [
    { source, destination },
    ...(prerelease && source.startsWith(`/docs/${prerelease}/`)
      ? [{ source: `/docs/next${source.slice(`/docs/${prerelease}`.length)}`, destination }]
      : []),
  ])

const ids = config.lines
  .filter(line => line.guides === 'authored')
  .flatMap(({ line }) =>
    readdirSync(path.join(checkout, 'content', line))
      .filter(file => file.endsWith('.md'))
      .map(file => {
        const slug = file.replace(/\.md$/, '')
        const { frontmatter } = parsePage(readFileSync(path.join(checkout, 'content', line, file), 'utf8'))
        return { line, slug, id: frontmatter.id ?? slug }
      }),
  )

const routes: LiveRoutes = {
  commit,
  paths: [...new Set([...pages, ...aliased])].sort(),
  pages: ids.sort((a, b) => a.line.localeCompare(b.line) || a.slug.localeCompare(b.slug)),
  redirects: redirects.sort((a, b) => a.source.localeCompare(b.source)),
}
writeFileSync(paths.liveRoutes, `${JSON.stringify(routes, null, 1)}\n`)
console.log(
  `${routes.paths.length} URLs, ${routes.redirects.length} redirects and ${routes.pages.length} page ids of ${commit} in ${paths.liveRoutes}`,
)
