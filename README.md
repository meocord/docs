# MeoCord docs

The documentation site for [MeoCord](https://github.com/meocord/meocord). Decorator-based framework for Discord bots on
discord.js, with dependency injection, guards, a CLI and a testing toolkit.

Every published version is documented, prereleases included. Code examples are compiled against the exact release
they describe, and the API reference is generated from the package published to npm.

## Development

Requires [Bun](https://bun.sh) 1.4.

```bash
bun install
bun run start:dev      # next dev behind the CSP hash proxy, on PORT (3000) and UPSTREAM_PORT (3001)
bun run build          # production build
bun run serve          # the production build, run as the image runs it
```

| Command                 | Use it to                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`          | Run ESLint                                                                                                                      |
| `bun run format:check`  | Check formatting with Prettier (`bun run format` rewrites)                                                                      |
| `bun run typecheck`     | Typecheck with `tsc`                                                                                                            |
| `bun run test:coverage` | Run the unit tests with coverage; thresholds are enforced in CI                                                                 |
| `bun run test:e2e`      | Run the Playwright smoke tests against a production build, on a port derived from the checkout's path (`E2E_PORT` overrides it) |
| `bun run budget:js`     | After a build, fail if any prerendered page loads more than 220 KB of gzipped JavaScript, and list its chunks                   |
| `bun run icons`         | Redraw the icons in `public/` and `src/app/favicon.ico`, and commit them                                                        |

### Measuring page speed

`bun run serve` sends uncompressed responses: the CSP hash proxy asks Next for identity bodies so it can hash them, and
compression happens downstream in production. Lighthouse pointed straight at it measures several times the bytes a
reader downloads. Measure through `e2e/performance.spec.ts` instead, which puts a gzip hop in front of the build and
holds the largest-paint budgets CI enforces, on Lighthouse's desktop and mobile presets and on mobile with applied
throttling:

```bash
bun run build && bun run test:e2e e2e/performance.spec.ts
```

## How it is served

Every page is rendered once and served byte-identical to every reader, so it can be cached at the edge:

- `src/proxy.ts` sets the cache and security headers. Its CSP leaves a marker in `script-src`, which
  `scripts/csp-hash-proxy.mjs`, the server's entrypoint, fills with the hashes of the inline scripts it sends.
- `/docs/latest/…` serves the current line under its own URL; `/docs/next/…` redirects to the line in prerelease.
- Search runs in the browser with [Pagefind](https://pagefind.app). `bun run build` first runs `bun run search:build`,
  which indexes each line's guides, migration guide, changelog and newest API from the committed content, and writes
  a Pagefind bundle at `/_pagefind/<line>.<hash>/` and a symbol and page index for the command palette at
  `/palette/<line>.<hash>.json`. Both are cached as immutable; `.search/manifest.json` names them for the app.
- Open Graph cards are drawn at `/og/<line>/<id>.<hash>.png`, with the content hash in the path, and cached as
  immutable.
- `bun run build` ends with `bun run precompress`, which writes a brotli copy at the highest quality beside each
  script, stylesheet and JSON file under `.next/static`, `public/_pagefind` and `public/palette` (`<file>.br`, only
  where it is smaller), then checks that every copy decompresses to its source; `bun run precompress -- --check` only
  checks. The CSP proxy sends them: for `/_next/static/…`, `/_pagefind/…` and `/palette/…`, when the request's
  `Accept-Encoding` allows `br` and the copy exists, it answers with the copy's bytes, `Content-Encoding: br` and
  `Vary: Accept-Encoding`, keeping Next's `Content-Type` and cache headers; otherwise it streams the source from Next,
  as for any other path. Pages have no copy: the proxy writes each page's hashes into its `<head>` as it serves it.
- Until launch, `SITE_INDEXABLE` is off: every response carries `X-Robots-Tag: noindex, nofollow`, robots.txt
  disallows everything and the sitemap is empty. It is read at build time; set `SITE_INDEXABLE=true` to build the
  indexable site.

Pushes to `main` publish a container image to `ghcr.io/meocord/docs`, with an SBOM and a build provenance
attestation.

## License

[MIT](LICENSE). The fonts in `assets/fonts` carry their own licences beside them: Instrument Sans and JetBrains Mono, both under
the SIL Open Font License 1.1.
