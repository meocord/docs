/**
 * Runs the production build locally the way the image runs it: the standalone server behind the
 * CSP hash proxy, under bun, laid out as the Dockerfile lays out /app. The copy is made in a temporary
 * directory outside the checkout, so a file the build's trace leaves out fails here as it fails in the
 * image, rather than resolving from the checkout's own node_modules.
 */
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

/** The scripts the Dockerfile copies beside the server: the proxy and the modules it imports. */
const PROXY_FILES = ['csp-hash-proxy.mjs', 'csp-proxy-server.mjs', 'csp-hash.mjs', 'process-tree.mjs']

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')
if (!existsSync(path.join(standalone, 'server.js'))) {
  console.error('No standalone build: run `bun run build` first.')
  process.exit(1)
}
const app = mkdtempSync(path.join(tmpdir(), 'meocord-docs-serve-'))
// Links stay as written, as Docker's COPY keeps them; made absolute, they would point back into the checkout
const copy = (from: string, to: string) => cpSync(from, to, { recursive: true, verbatimSymlinks: true })
copy(standalone, app)
copy(path.join(root, '.next', 'static'), path.join(app, '.next', 'static'))
copy(path.join(root, 'public'), path.join(app, 'public'))
for (const file of PROXY_FILES) copy(path.join(root, 'scripts', file), path.join(app, file))

const proxy = Bun.spawn(['bun', 'csp-hash-proxy.mjs'], { cwd: app, stdio: ['inherit', 'inherit', 'inherit'] })
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => proxy.kill(signal))
process.exitCode = await proxy.exited
rmSync(app, { recursive: true, force: true })
