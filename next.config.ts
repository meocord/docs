import type { NextConfig } from 'next'
import { guidePath, readGuide } from './scripts/lib/guide'
import { listPages } from './scripts/lib/pages'
import { DOC_ALIASES } from './src/config/aliases'
import { guideAliasRedirects } from './src/config/guide-aliases'
import { readExactRoutes } from './src/lib/docs/exact-routes'
import manifest from './versions.json'

/** Inlined at build: the header, robots.txt and the sitemap read one value and cannot disagree. */
const SITE_INDEXABLE = process.env.SITE_INDEXABLE === 'true' ? 'true' : 'false'

/**
 * Inlined at build into the proxy and the API route, the server code that reads it through `exactRoutes()`: which
 * version's page serves each exact version's API page, from `bun run api:routes`. A production build without it fails.
 */
const EXACT_ROUTES = readExactRoutes(process.env.NODE_ENV === 'production')

const nextConfig: NextConfig = {
  env: { SITE_INDEXABLE, EXACT_ROUTES },
  output: 'standalone',
  // The proxy sees the URL Next's server knows itself by, on 127.0.0.1, where Next would name it localhost: a rewrite
  // built on it is served by Next itself rather than fetched as another origin, whatever the request was forwarded as
  skipProxyUrlNormalize: true,
  cacheComponents: true,
  // Keeps today's per-link prefetching; Next warns on every build while it is unset
  partialPrefetching: false,
  reactCompiler: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compiler: { emotion: true },
  // A native addon, loaded at runtime rather than bundled. The glob takes whichever platform package
  // installed, except musl: the image runs on glibc.
  serverExternalPackages: ['meo-canvas'],
  // Bundled, off Next's default external list: loaded as an external, it resolves from the alias Next
  // links into .next/dev/node_modules, where the isolated linker leaves none of its dependencies.
  transpilePackages: ['shiki'],
  outputFileTracingIncludes: {
    '/og/**': [
      './node_modules/@meo-canvas/*-gnu/**/*',
      './node_modules/@meo-canvas/darwin-*/**/*',
      './node_modules/@meo-canvas/win32-*/**/*',
      './assets/fonts/**/*',
    ],
    // Where each line's search indexes are, and the reference's formatted code, for pages rendered at
    // request time.
    '/**': ['./.search/manifest.json', './.api-layout/*.json'],
  },
  // `/docs` to the current line, permanently since `latest` always stands for it; and each Guide path in a
  // line whose guides come from its README, sent to that line's page on the topic
  async redirects() {
    const lines = manifest.lines
      .filter(entry => entry.guides === 'readme')
      .map(({ line }) => ({ line, pages: listPages(line) }))
    return [
      { source: '/docs', destination: '/docs/latest', permanent: true },
      ...manifest.lines
        .filter(entry => entry.guides === 'authored')
        .flatMap(({ line }) =>
          guideAliasRedirects(
            lines,
            DOC_ALIASES.latest,
            readGuide(line).map(({ page }) => ({ ...page, path: guidePath(page) })),
            line,
          ),
        ),
    ]
  },
  async rewrites() {
    return [
      { source: '/docs/latest', destination: `/docs/${DOC_ALIASES.latest}` },
      { source: '/docs/latest/:path*', destination: `/docs/${DOC_ALIASES.latest}/:path*` },
    ]
  },
  // Every response, redirects and route handlers included: a year of HTTPS only, for this host alone. Paths
  // outside the proxy, the build's own output, are noindexed here while the site is not indexable.
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] },
      ...(SITE_INDEXABLE === 'true'
        ? []
        : [{ source: '/_next/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]),
    ]
  },
  experimental: {
    // The stylesheet goes in the document, so first paint waits on the document alone: applied LCP 1.05–1.25 s
    // against the 1.8 s gate, where its own request held it at 1.62–1.75 s. Experimental: re-check on a Next bump.
    inlineCss: true,
    swcPlugins: [
      [
        '@meonode/compiler',
        {
          callSiteLocations: process.env.NODE_ENV !== 'production',
          // Our prestyled factories, whose call sites it compiles as it does @meonode/ui's own. Each module
          // exports createNode factories only; src/components/nodes/index.spec.ts checks every one listed.
          factoryModules: ['@/components/nodes', '@/components/shell/glyph-slot'],
        },
      ],
    ],
  },
  devIndicators: false,
}

export default nextConfig
