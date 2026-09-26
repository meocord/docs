import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import http from 'node:http'
import http2 from 'node:http2'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const COMPRESSIBLE = /text|javascript|json|css|svg|x-component/
// Hop-by-hop headers, which HTTP/2 forbids and every hop sets for itself.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'host',
])

/** A self-signed certificate made for one run, in a directory removed at once; the browser is told to accept it. */
function certificate(): { key: Buffer; cert: Buffer } {
  const dir = mkdtempSync(path.join(tmpdir(), 'meocord-docs-edge-'))
  try {
    const [key, cert] = [path.join(dir, 'key.pem'), path.join(dir, 'cert.pem')]
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-keyout',
        key,
        '-out',
        cert,
        '-subj',
        '/CN=localhost',
      ],
      { stdio: 'ignore' },
    )
    return { key: readFileSync(key), cert: readFileSync(cert) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The parts of a request and its response the hop uses, which HTTP/1.1 and HTTP/2 share. */
interface Ask {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
}
interface Reply {
  headersSent: boolean
  writeHead(status: number, headers?: Record<string, string>): unknown
  end(body: Buffer | string): unknown
}

export interface EdgeHop {
  /** Where the hop answers, such as `https://127.0.0.1:4303`. */
  origin: string
  close: () => Promise<void>
}

/**
 * A hop in front of the served build that stands for the edge readers reach: HTTP/2 over TLS,
 * compressing text with brotli, or gzip for a client without it, as Cloudflare does by default. The CSP
 * proxy asks Next for uncompressed bodies to hash them, so without a hop the pages would be measured
 * at several times the bytes a reader downloads. Each compressed body is kept per path, as an edge
 * cache would, so compressing never counts as server time. `h1` serves plain HTTP/1.1 instead, for
 * comparison.
 */
export async function edgeHop(upstream: string, port: number, protocol: 'h2' | 'h1' = 'h2'): Promise<EdgeHop> {
  const kept = new Map<string, { status: number; headers: Record<string, string>; body: Buffer }>()

  const handle = async (req: Ask, res: Reply) => {
    const accepts = String(req.headers['accept-encoding'] ?? '')
    const encoding = accepts.includes('br') ? 'br' : accepts.includes('gzip') ? 'gzip' : 'identity'
    const key = `${req.method} ${req.url} ${encoding}`
    const hit = kept.get(key)
    if (hit) {
      res.writeHead(hit.status, hit.headers)
      res.end(hit.body)
      return
    }
    const headers: Record<string, string> = {}
    for (const [name, value] of Object.entries(req.headers)) {
      if (!name.startsWith(':') && !HOP_BY_HOP.has(name) && typeof value === 'string') headers[name] = value
    }
    const response = await fetch(new URL(req.url ?? '/', upstream), { method: req.method, headers, redirect: 'manual' })
    const out: Record<string, string> = {}
    response.headers.forEach((value, name) => {
      if (!HOP_BY_HOP.has(name) && name !== 'content-length') out[name] = value
    })
    let body = Buffer.from(await response.arrayBuffer())
    if (COMPRESSIBLE.test(response.headers.get('content-type') ?? '') && !response.headers.has('content-encoding')) {
      if (encoding === 'br') body = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
      else if (encoding === 'gzip') body = gzipSync(body)
      if (encoding !== 'identity') out['content-encoding'] = encoding
      out.vary = 'Accept-Encoding'
    }
    out['content-length'] = String(body.byteLength)
    if (req.method === 'GET' && response.status === 200) kept.set(key, { status: response.status, headers: out, body })
    res.writeHead(response.status, out)
    res.end(body)
  }
  const onRequest = (req: Ask, res: Reply) =>
    handle(req, res).catch(error => {
      if (!res.headersSent) res.writeHead(502)
      res.end(String(error))
    })

  const server =
    protocol === 'h2'
      ? http2.createSecureServer({ ...certificate(), allowHTTP1: false }, onRequest)
      : http.createServer(onRequest)
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  return {
    origin: `${protocol === 'h2' ? 'https' : 'http'}://127.0.0.1:${port}`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  }
}
