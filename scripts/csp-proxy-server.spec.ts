import http from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { MARKER } from './csp-hash.mjs'
import { createProxyServer, fail } from './csp-proxy-server.mjs'

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
  it('hashes an HTML page into its policy', async () => {
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
