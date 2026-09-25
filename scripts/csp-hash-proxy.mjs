/**
 * The container's entrypoint: supervises the Next server and sits in front of it, hashing each HTML
 * response's inline scripts into its CSP. Hashes come from the bytes sent, so a page carries no
 * per-request nonce and one render can be cached and shared. Pages have no Suspense holes, so Next
 * emits them in one piece and buffering costs about a millisecond.
 */
import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { createProxyServer } from './csp-proxy-server.mjs'
import { killTree } from './process-tree.mjs'

const LISTEN = Number(process.env.PORT ?? 3000)
const UPSTREAM = Number(process.env.UPSTREAM_PORT ?? LISTEN + 1)
// Development runs `next dev` behind the same hop, so a page is never tried under a looser policy.
const CHILD = (process.env.CSP_PROXY_CHILD ?? `${process.execPath} server.js`).split(' ')

const server = createProxyServer(UPSTREAM)

/**
 * Next runs as this process's child, so its death is this process's death and a SIGTERM reaches it.
 * Two backgrounded processes would leave a proxy answering 502s while looking healthy. When this
 * process goes down on its own, it takes Next's whole process tree with it: `next dev` forks workers
 * that hold the upstream port, and killing only its first process would leave them running.
 */
function startNext() {
  const [command, ...args] = CHILD
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(UPSTREAM), HOSTNAME: '127.0.0.1' },
  })

  const takeDown = () => {
    if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) killTree(child.pid, 'SIGKILL')
  }
  process.on('exit', takeDown)
  process.on('uncaughtException', error => {
    console.error('[csp-hash]', error)
    takeDown()
    process.exit(1)
  })
  server.on('error', error => {
    console.error('[csp-hash] listen failed:', error.message)
    takeDown()
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    console.error(`[csp-hash] next exited (code=${code} signal=${signal}), stopping`)
    process.exit(code ?? 1)
  })

  for (const signal of /** @type {const} */ (['SIGTERM', 'SIGINT'])) {
    process.on(signal, () => {
      // Next stops its own workers on these; the tree is killed only if it does not stop in time.
      child.kill(signal)
      setTimeout(() => {
        takeDown()
        process.exit(0)
      }, 10_000).unref()
    })
  }
}

/** Listening is not readiness: wait until the upstream port accepts. */
function waitForUpstream(attempt = 0) {
  const socket = connect(UPSTREAM, '127.0.0.1')
  socket.on('connect', () => {
    socket.destroy()
    server.listen(LISTEN, '0.0.0.0', () => console.log(`[csp-hash] :${LISTEN} -> :${UPSTREAM}`))
  })
  socket.on('error', () => {
    socket.destroy()
    if (attempt > 300) {
      console.error('[csp-hash] upstream never came up')
      process.exit(1)
    }
    setTimeout(() => waitForUpstream(attempt + 1), 200)
  })
}

startNext()
waitForUpstream()
