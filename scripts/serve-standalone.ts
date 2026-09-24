/**
 * Runs the production build locally the way the image runs it: the standalone server behind the
 * CSP hash proxy, under bun. Copies in the static output and public/, which standalone leaves out.
 */
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')
if (!existsSync(path.join(standalone, 'server.js'))) {
  console.error('No standalone build: run `bun run build` first.')
  process.exit(1)
}
cpSync(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true })
cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true })

const proxy = Bun.spawn(['bun', path.join(root, 'scripts', 'csp-hash-proxy.mjs')], {
  cwd: standalone,
  env: { ...process.env, CSP_PROXY_CHILD: `${process.execPath} server.js` },
  stdio: ['inherit', 'inherit', 'inherit'],
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => proxy.kill(signal))
process.exitCode = await proxy.exited
