/**
 * The HTTP hop in front of Next: HTML responses are buffered and get their inline scripts' hashes in
 * a CSP meta tag at the top of `<head>`, so the header stays the same size on every page; the build's
 * immutable assets go out as their brotli copies to a client that takes brotli; everything else
 * streams through. A failure on one request ends that request only: before any header is sent it is
 * answered 502, after that its socket is closed.
 */
import { createReadStream, statSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
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
 * Whether an Accept-Encoding header takes brotli: `br` listed, and not with q=0.
 * @param {string} [header]
 */
export function acceptsBrotli(header = '') {
  return header.split(',').some(part => {
    const [name, ...params] = part.trim().toLowerCase().split(';')
    if (name.trim() !== 'br') return false
    const q = params.map(param => param.trim()).find(param => param.startsWith('q='))
    return q === undefined || Number(q.slice(2)) > 0
  })
}

/**
 * Where a request's brotli copy would be, for the paths whose copies the build writes
 * (scripts/precompress.ts): `/_next/static/…` under `.next/static`, and `/_pagefind/…` and
 * `/palette/…` under `public`, from `root`. Undefined for any other path or one that leaves its root.
 * @param {string} root
 * @param {string | undefined} url
 */
export function brotliCopyPath(root, url = '/') {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname)
  } catch {
    // A malformed escape names no file; Next answers it.
    return undefined
  }
  const [base, rest] = pathname.startsWith('/_next/static/')
    ? [path.join(root, '.next', 'static'), pathname.slice('/_next/static/'.length)]
    : /^\/(?:_pagefind|palette)\//.test(pathname)
      ? [path.join(root, 'public'), pathname.slice(1)]
      : []
  if (!base || !rest) return undefined
  const file = path.resolve(base, rest)
  return file.startsWith(base + path.sep) ? `${file}.br` : undefined
}

/**
 * The size of a file, or undefined when there is none.
 * @param {string} file
 */
function sizeOf(file) {
  try {
    const stat = statSync(file)
    return stat.isFile() ? stat.size : undefined
  } catch {
    return undefined
  }
}

/**
 * `value` with `Accept-Encoding` added to a Vary header, once.
 * @param {string | string[] | undefined} value
 */
function varyOnEncoding(value) {
  const listed = (Array.isArray(value) ? value.join(', ') : (value ?? '')).trim()
  if (/(^|,)\s*(accept-encoding|\*)\s*(,|$)/i.test(listed)) return listed
  return listed ? `${listed}, Accept-Encoding` : 'Accept-Encoding'
}

/**
 * A server forwarding to Next on `upstreamPort` at 127.0.0.1. Brotli copies are looked for under
 * `root`, the directory the server runs from.
 * @param {number} upstreamPort
 * @param {{ root?: string }} [options]
 */
export function createProxyServer(upstreamPort, { root = process.cwd() } = {}) {
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

          // An asset with a brotli copy: Next's headers, and the copy's bytes for a client that takes them.
          const copy = brotliCopyPath(root, req.url)
          const copySize = copy && !up.headers['content-encoding'] ? sizeOf(copy) : undefined
          if (copy && copySize !== undefined && (up.statusCode === 200 || up.statusCode === 304)) {
            passthrough.vary = varyOnEncoding(passthrough.vary)
            if (up.statusCode === 200 && acceptsBrotli(String(req.headers['accept-encoding'] ?? ''))) {
              up.resume()
              passthrough['content-encoding'] = 'br'
              passthrough['content-length'] = String(copySize)
              delete passthrough['transfer-encoding']
              // Another encoding is another representation, so it gets its own validator.
              if (typeof passthrough.etag === 'string') passthrough.etag = passthrough.etag.replace(/"$/, '-br"')
              res.writeHead(200, passthrough)
              if (req.method === 'HEAD') {
                res.end()
                return
              }
              const stream = createReadStream(copy)
              stream.on('error', error => fail(res, error))
              stream.pipe(res)
              return
            }
          }

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
