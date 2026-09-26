import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brotliCompressSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { MARKER } from './csp-hash.mjs'
import { acceptsBrotli, brotliCopyPath, createProxyServer, fail } from './csp-proxy-server.mjs'

const servers: http.Server[] = []

async function listen(server: http.Server): Promise<number> {
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return (server.address() as AddressInfo).port
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

/** A proxy in front of an upstream that answers each request with `handler`. */
async function proxyFor(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<number> {
  const upstream = await listen(http.createServer(handler))
  return listen(createProxyServer(upstream))
}

interface Result {
  status?: number
  headers?: http.IncomingHttpHeaders
  body: string
  /** How the response ended when it did not complete. */
  error?: string
}

function get(port: number, path = '/'): Promise<Result> {
  return new Promise(resolve => {
    const request = http.get({ host: '127.0.0.1', port, path }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => (body += chunk))
      response.on('end', () =>
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body,
          error: response.complete ? undefined : 'incomplete',
        }),
      )
      response.on('error', error => resolve({ status: response.statusCode, body, error: error.message }))
    })
    request.on('error', error => resolve({ body: '', error: error.message }))
  })
}

// The upstream's socket, cut without an HTTP response or partway through one.
const cut = (res: http.ServerResponse) => (res.socket as Socket).destroy()

describe('createProxyServer', () => {
  it('moves a page’s script hashes into a meta tag at the top of its head, and keeps the header fixed', async () => {
    const page = (scripts: number) =>
      `<!DOCTYPE html><html><head><meta charSet="utf-8"/><title>t</title></head><body>${Array.from(
        { length: scripts },
        (_, index) => `<script>self.__next_f.push([${index}])</script>`,
      ).join('')}</body></html>`
    const policy = `default-src 'self'; script-src ${MARKER} 'self'; frame-ancestors 'self'`
    const serve = (html: string) =>
      proxyFor((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': policy })
        res.end(html)
      })
    const small = await get(await serve(page(1)))
    const large = await get(await serve(page(2000)))

    expect(small.headers?.['content-security-policy']).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'self'",
    )
    // However many scripts a page has, its header is the same.
    expect(large.headers?.['content-security-policy']).toBe(small.headers?.['content-security-policy'])
    expect(large.body).toMatch(
      /^<!DOCTYPE html><html><head><meta charSet="utf-8"\/><meta http-equiv="Content-Security-Policy" content="script-src 'self'( 'sha256-[^']+'){2000}">/,
    )
    expect(Number(large.headers?.['content-length'])).toBe(Buffer.byteLength(large.body))
  })

  it('keeps the whole policy in the header for a page with no head to carry the meta', async () => {
    const port = await proxyFor((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': `script-src ${MARKER} 'self'` })
      res.end('<script>a()</script>')
    })
    const result = await get(port)
    expect(result.status).toBe(200)
    expect(result.headers?.['content-security-policy']).toMatch(/^script-src 'sha256-[^']+' 'self'$/)
    expect(result.body).toBe('<script>a()</script>')
  })

  it('answers 502 when the upstream fails before any header', async () => {
    const port = await proxyFor((_req, res) => cut(res))
    const result = await get(port)
    expect(result.status).toBe(502)
    expect(result.body).toMatch(/^upstream unreachable: /)
  })

  it('answers 502 when the upstream is not listening', async () => {
    const closed = await listen(http.createServer())
    await new Promise(resolve => servers.pop()!.close(resolve))
    const port = await listen(createProxyServer(closed))
    expect((await get(port)).status).toBe(502)
  })

  it('answers 502 when an HTML page is cut before it is complete, since nothing was sent yet', async () => {
    const port = await proxyFor((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': `script-src ${MARKER}` })
      res.write('<p>partial')
      setTimeout(() => cut(res), 10)
    })
    expect((await get(port)).status).toBe(502)
  })

  it('closes the socket when a streamed response is cut after its headers, and keeps serving', async () => {
    let requests = 0
    const port = await proxyFor((_req, res) => {
      requests += 1
      if (requests === 1) {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.write('partial')
        setTimeout(() => cut(res), 10)
      } else {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.end('whole')
      }
    })
    const broken = await get(port)
    expect(broken.status).toBe(200)
    expect(broken.error).toBeDefined()

    const next = await get(port)
    expect(next).toMatchObject({ status: 200, body: 'whole', error: undefined })
  })

  it('drops the upstream request when the client goes away, and keeps serving', async () => {
    let upstreamClosed!: () => void
    const closed = new Promise<void>(resolve => (upstreamClosed = resolve))
    let requests = 0
    const port = await proxyFor((req, res) => {
      requests += 1
      if (requests === 1) {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.write('streaming')
        req.socket.on('close', upstreamClosed)
      } else {
        res.end('whole')
      }
    })

    await new Promise<void>(resolve => {
      const request = http.get({ host: '127.0.0.1', port, path: '/' }, response => {
        response.once('data', () => {
          request.destroy()
          resolve()
        })
      })
      request.on('error', () => undefined)
    })
    await closed
    expect((await get(port)).body).toBe('whole')
  })
})

describe('fail', () => {
  it('closes a response whose headers are sent instead of throwing ERR_HTTP_HEADERS_SENT, once', async () => {
    const thrown: unknown[] = []
    const port = await listen(
      http.createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.write('partial')
        try {
          fail(res, new Error('upstream reset'))
          fail(res, new Error('upstream reset again'))
        } catch (error) {
          thrown.push(error)
        }
      }),
    )
    const result = await get(port)
    expect(thrown).toEqual([])
    // The client sees the connection end without a complete response.
    expect(result.error).toBeDefined()
  })

  it('answers 502 while nothing is sent, and ignores a second failure', async () => {
    const port = await listen(
      http.createServer((_req, res) => {
        fail(res, new Error('refused'))
        fail(res, new Error('again'))
      }),
    )
    expect(await get(port)).toMatchObject({ status: 502, body: 'upstream unreachable: refused' })
  })
})

describe('brotli copies', () => {
  const script = 'export const words = "' + 'the quick brown fox '.repeat(100) + '"\n'
  const brotli = brotliCompressSync(script)
  let root: string

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  /** A build's files under a fresh root, and a proxy in front of an upstream serving `script` as Next would. */
  async function serve(files: Record<string, string | Buffer>): Promise<number> {
    root = mkdtempSync(path.join(tmpdir(), 'meocord-docs-proxy-'))
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
      writeFileSync(path.join(root, name), content)
    }
    const upstream = await listen(
      http.createServer((req, res) => {
        if (req.url?.includes('missing')) {
          res.writeHead(404, { 'content-type': 'text/plain' })
          res.end('not found')
          return
        }
        res.writeHead(200, {
          'content-type': 'application/javascript; charset=UTF-8',
          'cache-control': 'public, max-age=31536000, immutable',
          etag: '"abc"',
          'x-accept-encoding': String(req.headers['accept-encoding']),
        })
        res.end(req.method === 'HEAD' ? undefined : script)
      }),
    )
    return listen(createProxyServer(upstream, { root }))
  }

  function fetchRaw(port: number, url: string, headers: http.OutgoingHttpHeaders = {}, method = 'GET') {
    return new Promise<{ status?: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port, path: url, method, headers }, response => {
        const chunks: Buffer[] = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () =>
          resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }),
        )
      })
      request.on('error', reject)
      request.end()
    })
  }

  it("sends a static chunk's brotli copy to a client that takes brotli, with Next's type and caching", async () => {
    const port = await serve({ '.next/static/chunks/a.js': script, '.next/static/chunks/a.js.br': brotli })
    const response = await fetchRaw(port, '/_next/static/chunks/a.js', { 'accept-encoding': 'gzip, deflate, br, zstd' })
    expect(response.status).toBe(200)
    expect(response.headers['content-encoding']).toBe('br')
    expect(response.headers['content-length']).toBe(String(brotli.byteLength))
    expect(response.headers.vary).toBe('Accept-Encoding')
    expect(response.headers['content-type']).toBe('application/javascript; charset=UTF-8')
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(response.headers.etag).toBe('"abc-br"')
    // Next is still asked for identity, whatever the client takes.
    expect(response.headers['x-accept-encoding']).toBe('identity')
    expect(response.body.equals(brotli)).toBe(true)
  })

  it('sends the search bundles and palette indexes from public the same way', async () => {
    const port = await serve({
      'public/_pagefind/4.1.abc/pagefind.js.br': brotli,
      'public/_pagefind/4.1.abc/pagefind.js': script,
      'public/palette/4.1.abc.json.br': brotli,
      'public/palette/4.1.abc.json': script,
    })
    for (const url of ['/_pagefind/4.1.abc/pagefind.js', '/palette/4.1.abc.json']) {
      const response = await fetchRaw(port, url, { 'accept-encoding': 'br' })
      expect(response.headers['content-encoding'], url).toBe('br')
      expect(response.body.equals(brotli), url).toBe(true)
    }
  })

  it('streams the source from Next to a client without brotli, or one that refuses it, still varying on it', async () => {
    const port = await serve({ '.next/static/chunks/a.js': script, '.next/static/chunks/a.js.br': brotli })
    for (const accept of [undefined, 'gzip, deflate', 'gzip, br;q=0']) {
      const response = await fetchRaw(port, '/_next/static/chunks/a.js', accept ? { 'accept-encoding': accept } : {})
      expect(response.headers['content-encoding'], accept).toBeUndefined()
      expect(response.headers.vary, accept).toBe('Accept-Encoding')
      expect(response.headers.etag, accept).toBe('"abc"')
      expect(response.body.toString(), accept).toBe(script)
    }
  })

  it('streams from Next when there is no copy, the path has none, or Next does not answer 200', async () => {
    const port = await serve({ '.next/static/chunks/a.js': script, 'public/icon.svg.br': brotli })
    for (const url of ['/_next/static/chunks/a.js', '/icon.svg']) {
      const response = await fetchRaw(port, url, { 'accept-encoding': 'br' })
      expect(response.headers['content-encoding'], url).toBeUndefined()
      expect(response.headers.vary, url).toBeUndefined()
      expect(response.body.toString(), url).toBe(script)
    }
    const missing = await fetchRaw(port, '/_next/static/chunks/missing.js', { 'accept-encoding': 'br' })
    expect(missing.status).toBe(404)
    expect(missing.headers['content-encoding']).toBeUndefined()
  })

  it("answers HEAD with the copy's headers and no body", async () => {
    const port = await serve({ '.next/static/chunks/a.js': script, '.next/static/chunks/a.js.br': brotli })
    const response = await fetchRaw(port, '/_next/static/chunks/a.js', { 'accept-encoding': 'br' }, 'HEAD')
    expect(response.headers['content-encoding']).toBe('br')
    expect(response.headers['content-length']).toBe(String(brotli.byteLength))
    expect(response.body.byteLength).toBe(0)
  })

  it('never reads a copy outside the build, however the path is written', async () => {
    const port = await serve({ 'secret.js.br': brotli, '.next/static/chunks/a.js': script })
    for (const url of [
      '/_next/static/../../secret.js',
      '/_next/static/%2e%2e/%2e%2e/secret.js',
      '/palette/..%2f..%2fsecret.js',
    ]) {
      const response = await fetchRaw(port, url, { 'accept-encoding': 'br' })
      expect(response.headers['content-encoding'], url).toBeUndefined()
    }
  })
})

describe('acceptsBrotli', () => {
  it('takes br listed with no weight or a positive one, and not at q=0 or absent', () => {
    expect(acceptsBrotli('gzip, deflate, br, zstd')).toBe(true)
    expect(acceptsBrotli('BR;q=0.5')).toBe(true)
    expect(acceptsBrotli('br;q=0')).toBe(false)
    expect(acceptsBrotli('gzip')).toBe(false)
    expect(acceptsBrotli('brotli')).toBe(false)
    expect(acceptsBrotli()).toBe(false)
  })
})

describe('brotliCopyPath', () => {
  it('maps the three asset paths under their roots, and nothing else', () => {
    const root = '/app'
    expect(brotliCopyPath(root, '/_next/static/chunks/a.js?v=1')).toBe('/app/.next/static/chunks/a.js.br')
    expect(brotliCopyPath(root, '/_pagefind/4.1.abc/pagefind.js')).toBe('/app/public/_pagefind/4.1.abc/pagefind.js.br')
    expect(brotliCopyPath(root, '/palette/4.1.abc.json')).toBe('/app/public/palette/4.1.abc.json.br')
    expect(brotliCopyPath(root, '/docs/4.1/defer')).toBeUndefined()
    expect(brotliCopyPath(root, '/_next/static/')).toBeUndefined()
    expect(brotliCopyPath(root, '/_next/static/../../etc/passwd')).toBeUndefined()
    expect(brotliCopyPath(root, '/_next/static/%E0%A4%A.js')).toBeUndefined()
  })
})
