import type { NextConfig } from 'next'
import { DOC_ALIASES } from './src/config/aliases'

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
  outputFileTracingIncludes: {
    '/og/**': [
      './node_modules/@meo-canvas/*-gnu/**/*',
      './node_modules/@meo-canvas/darwin-*/**/*',
      './node_modules/@meo-canvas/win32-*/**/*',
      './assets/fonts/**/*',
    ],
    // Where each line's search indexes are, for pages rendered at request time.
    '/**': ['./.search/manifest.json'],
  },
  async rewrites() {
    return [
      { source: '/docs/latest', destination: `/docs/${DOC_ALIASES.latest}` },
      { source: '/docs/latest/:path*', destination: `/docs/${DOC_ALIASES.latest}/:path*` },
    ]
  },
  // Paths outside the proxy: the build's own output is noindexed here while the site is not indexable.
  async headers() {
    return SITE_INDEXABLE === 'true'
      ? []
      : [{ source: '/_next/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
  },
  experimental: {
    swcPlugins: [['@meonode/compiler', { callSiteLocations: process.env.NODE_ENV !== 'production' }]],
  },
  devIndicators: false,
}

export default nextConfig
