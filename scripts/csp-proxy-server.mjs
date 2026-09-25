/**
 * The HTTP hop in front of Next: HTML responses are buffered and get their inline scripts' hashes in
 * a CSP meta tag at the top of `<head>`, so the header stays the same size on every page; everything
 * else streams through. A failure on one request ends that request only: before
 * any header is sent it is answered 502, after that its socket is closed.
 */
import http from 'node:http'
import { MARKER, fillPolicy, passthroughPolicy, splitPolicy } from './csp-hash.mjs'

/**
 * Ends a response an upstream failure left unfinished: a 502 while no header is sent, otherwise
 * its socket is closed, since a status can no longer be changed.
 * @param {http.ServerResponse} res
 * @param {Error} error
 */
export function fail(res, error) {
  // Already answered, such as the 502 an earlier error on this request sent.
  if (res.writableEnded) return
  if (res.headersSent) {
    res.destroy(error)
    return
  }
  res.writeHead(502, { 'content-type': 'text/plain' })
  res.end(`upstream unreachable: ${error.message}`)
}

/**
 * A server forwarding to Next on `upstreamPort` at 127.0.0.1.
 * @param {number} upstreamPort
 */
export function createProxyServer(upstreamPort) {
  const server = http.createServer((req, res) => {
    // A compressed body cannot be hashed; nginx compresses downstream of this hop.
    const headers = { ...req.headers, 'accept-encoding': 'identity' }

    const upstream = http.request(
      { hostname: '127.0.0.1', port: upstreamPort, path: req.url, method: req.method, headers },
      up => {
        // An upstream that dies mid-response ends this response, never the process.
        up.on('error', error => fail(res, error))
        up.on('aborted', () => fail(res, new Error('upstream closed the response')))

        const type = up.headers['content-type'] ?? ''
        const header = up.headers['content-security-policy']
        const csp = Array.isArray(header) ? header.join(', ') : header
        const bodiless = req.method === 'HEAD' || up.statusCode === 304

        if (bodiless || up.headers['content-encoding'] || !type.includes('text/html') || !csp?.includes(MARKER)) {
          // The marker never reaches a browser; a 304 keeps the policy its cached page came with.
          const passthrough = { ...up.headers }
          const policy = passthroughPolicy(csp, bodiless)
          if (policy === undefined) delete passthrough['content-security-policy']
          else passthrough['content-security-policy'] = policy
          res.writeHead(up.statusCode ?? 200, passthrough)
          up.pipe(res)
          return
        }

        /** @type {Buffer[]} */
        const chunks = []
        up.on('data', chunk => chunks.push(chunk))
        up.on('end', () => {
          if (!up.complete) return
          const sent = Buffer.concat(chunks).toString('utf8')
          // The same bytes in give the same bytes out, so the page's ETag still names what is sent.
          const split = splitPolicy(csp, sent)
          const html = split?.html ?? sent
          const out = { ...up.headers, 'content-security-policy': split?.header ?? fillPolicy(csp, sent) }
          out['content-length'] = String(Buffer.byteLength(html))
          delete out['transfer-encoding']
          res.writeHead(up.statusCode ?? 200, out)
          res.end(html)
        })
      },
    )

    upstream.on('error', error => fail(res, error))
    // A client that goes away takes its upstream request with it.
    req.on('error', () => upstream.destroy())
    res.on('error', () => upstream.destroy())
    res.on('close', () => {
      if (!res.writableFinished) upstream.destroy()
    })

    req.pipe(upstream)
  })

  // `next dev` pushes updates over a WebSocket; join the two sockets untouched once upstream upgrades.
  server.on('upgrade', (req, socket, head) => {
    const upstream = http.request({
      hostname: '127.0.0.1',
      port: upstreamPort,
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
      upSocket.on('error', () => socket.destroy())
      upSocket.pipe(socket)
      socket.pipe(upSocket)
    })

    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
    upstream.end()
  })

  return server
}
