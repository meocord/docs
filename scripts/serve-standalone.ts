/**
 * Runs the production build locally the way the image runs it: the standalone server behind the
 * CSP hash proxy, under bun, laid out as the Dockerfile lays out /app. The layout is made in a
 * temporary directory outside the checkout, so a file the build's trace leaves out fails here as it
 * fails in the image, rather than resolving from the checkout's own node_modules.
 */
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

/** The scripts the Dockerfile copies beside the server: the proxy and the modules it imports. */
const PROXY_FILES = ['csp-hash-proxy.mjs', 'csp-proxy-server.mjs', 'csp-hash.mjs', 'process-tree.mjs']

/** Whether hard links failed across filesystems once, so the rest is copied without trying them. */
let copying = false

/** Places one file at `to`: a hard link, since the prerendered pages run to gigabytes, or a copy across filesystems. */
function place(from: string, to: string) {
  // A build that `bun run serve` ran in place already holds the static files and public/ it copied in
  rmSync(to, { force: true })
  if (!copying) {
    try {
      return linkSync(from, to)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
      copying = true
    }
  }
  copyFileSync(from, to)
}

/**
 * Mirrors a tree into `to`, keeping links as written, as Docker's COPY does: made absolute, they would point back
 * into the checkout.
 */
function mirror(from: string, to: string) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const [source, target] = [path.join(from, entry.name), path.join(to, entry.name)]
    if (entry.isSymbolicLink()) symlinkSync(readlinkSync(source), target)
    else if (entry.isDirectory()) mirror(source, target)
    else place(source, target)
  }
}

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')
if (!existsSync(path.join(standalone, 'server.js'))) {
  console.error('No standalone build: run `bun run build` first.')
  process.exit(1)
}
const app = mkdtempSync(path.join(tmpdir(), 'meocord-docs-serve-'))
mirror(standalone, app)
mirror(path.join(root, '.next', 'static'), path.join(app, '.next', 'static'))
mirror(path.join(root, 'public'), path.join(app, 'public'))
for (const file of PROXY_FILES) place(path.join(root, 'scripts', file), path.join(app, file))

const proxy = Bun.spawn(['bun', 'csp-hash-proxy.mjs'], { cwd: app, stdio: ['inherit', 'inherit', 'inherit'] })
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => proxy.kill(signal))
process.exitCode = await proxy.exited
rmSync(app, { recursive: true, force: true })
