/**
 * The container's entrypoint: supervises the Next server and sits in front of it, hashing each HTML
 * response's inline scripts into its CSP. Hashes come from the bytes sent, so a page carries no
 * per-request nonce and one render can be cached and shared. Pages have no Suspense holes, so Next
 * emits them in one piece and buffering costs about a millisecond.
 */
import http from 'node:http'
import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { MARKER, fillPolicy } from './csp-hash.mjs'

const LISTEN = Number(process.env.PORT ?? 3000)
const UPSTREAM = Number(process.env.UPSTREAM_PORT ?? LISTEN + 1)
// Development runs `next dev` behind the same hop, so a page is never tried under a looser policy.
const CHILD = (process.env.CSP_PROXY_CHILD ?? `${process.execPath} server.js`).split(' ')

const server = http.createServer((req, res) => {
  // A compressed body cannot be hashed; nginx compresses downstream of this hop.
  const headers = { ...req.headers, 'accept-encoding': 'identity' }

  const upstream = http.request(
    { hostname: '127.0.0.1', port: UPSTREAM, path: req.url, method: req.method, headers },
    up => {
      const type = up.headers['content-type'] ?? ''
      const header = up.headers['content-security-policy']
      const csp = Array.isArray(header) ? header.join(', ') : header
      const bodiless = req.method === 'HEAD' || up.statusCode === 304

      if (bodiless || up.headers['content-encoding'] || !type.includes('text/html') || !csp?.includes(MARKER)) {
        // The marker never reaches a browser, even on a response this does not rewrite.
        const passthrough = { ...up.headers }
        if (csp?.includes(MARKER)) passthrough['content-security-policy'] = fillPolicy(csp)
        res.writeHead(up.statusCode ?? 200, passthrough)
        up.pipe(res)
        return
      }

      /** @type {Buffer[]} */
      const chunks = []
      up.on('data', chunk => chunks.push(chunk))
      up.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8')
        const out = { ...up.headers, 'content-security-policy': fillPolicy(csp, html) }
        out['content-length'] = String(Buffer.byteLength(html))
        delete out['transfer-encoding']
        res.writeHead(up.statusCode ?? 200, out)
        res.end(html)
      })
    },
  )

  upstream.on('error', err => {
    res.writeHead(502, { 'content-type': 'text/plain' })
    res.end(`upstream unreachable: ${err.message}`)
  })

  req.pipe(upstream)
})

// `next dev` pushes updates over a WebSocket; join the two sockets untouched once upstream upgrades.
server.on('upgrade', (req, socket, head) => {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: UPSTREAM,
    path: req.url,
    method: req.method,
    headers: req.headers,
  })

  upstream.on('upgrade', (up, upSocket, upHead) => {
    const lines = [`HTTP/1.1 ${up.statusCode} ${up.statusMessage}`]
    for (const [key, value] of Object.entries(up.headers)) lines.push(`${key}: ${value}`)
    socket.write([...lines, '', ''].join('\r\n'))
    if (upHead?.length) socket.write(upHead)
    if (head?.length) upSocket.write(head)
    upSocket.pipe(socket)
    socket.pipe(upSocket)
  })

  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
  upstream.end()
})

/**
 * Next runs as this process's child, so its death is this process's death and a SIGTERM reaches it.
 * Two backgrounded processes would leave a proxy answering 502s while looking healthy.
 */
function startNext() {
  const [command, ...args] = CHILD
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(UPSTREAM), HOSTNAME: '127.0.0.1' },
  })

  const takeDown = () => {
    if (!child.killed) child.kill('SIGKILL')
  }
  process.on('exit', takeDown)
  process.on('uncaughtException', err => {
    console.error('[csp-hash]', err)
    takeDown()
    process.exit(1)
  })
  server.on('error', err => {
    console.error('[csp-hash] listen failed:', err.message)
    takeDown()
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    console.error(`[csp-hash] next exited (code=${code} signal=${signal}), stopping`)
    process.exit(code ?? 1)
  })

  for (const signal of /** @type {const} */ (['SIGTERM', 'SIGINT'])) {
    process.on(signal, () => {
      child.kill(signal)
      // The ceiling on a child that refuses to stop.
      setTimeout(() => process.exit(0), 10_000).unref()
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
