import type { NextConfig } from 'next'
import { guidePath, readGuide } from './scripts/lib/guide'
import { listPages } from './scripts/lib/pages'
import { DOC_ALIASES } from './src/config/aliases'
import { guideAliasRedirects } from './src/config/guide-aliases'
import manifest from './versions.json'

/** Inlined at build: the header, robots.txt and the sitemap read one value and cannot disagree. */
const SITE_INDEXABLE = process.env.SITE_INDEXABLE === 'true' ? 'true' : 'false'

const nextConfig: NextConfig = {
  env: { SITE_INDEXABLE },
  output: 'standalone',
  cacheComponents: true,
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
    swcPlugins: [
      [
        '@meonode/compiler',
        {
          callSiteLocations: process.env.NODE_ENV !== 'production',
          // Our prestyled factories, whose call sites it compiles as it does @meonode/ui's own. The
          // module exports createNode factories only; src/components/nodes/index.spec.ts checks it.
          factoryModules: ['@/components/nodes'],
        },
      ],
    ],
  },
  devIndicators: false,
}

export default nextConfig
