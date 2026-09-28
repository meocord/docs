import { readFileSync } from 'node:fs'
import http from 'node:http'
import http2 from 'node:http2'
import path from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'
import { edgeHop } from './edge-hop'
import { e2ePort } from './port'

/** A response's status, headers and raw bytes, as sent: nothing decompresses them. */
function fetchRaw(url: string, headers: http.OutgoingHttpHeaders) {
  return new Promise<{ status?: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    http
      .get(url, { headers }, response => {
        const chunks: Buffer[] = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () =>
          resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }),
        )
      })
      .on('error', reject)
  })
}

// The build the server runs from; `bun run serve` copies its static files beside the standalone server.
const built = (asset: string) => path.join(process.cwd(), '.next', 'static', asset.replace(/^\/_next\/static\//, ''))

test('a page’s scripts go out as their brotli copies to a browser that takes brotli, gzip to one that takes only gzip, and as themselves otherwise', async ({
  page,
  baseURL,
}) => {
  await page.goto('/docs/4.1/defer')
  const src = await page.locator('script[src^="/_next/static/chunks/"]:not([nomodule])').first().getAttribute('src')
  expect(src).toBeTruthy()
  const url = new URL(src!, baseURL).toString()

  const brotli = await fetchRaw(url, { 'accept-encoding': 'gzip, deflate, br, zstd' })
  expect(brotli.status).toBe(200)
  expect(brotli.headers['content-encoding']).toBe('br')
  expect(brotli.headers.vary).toMatch(/accept-encoding/i)
  expect(brotli.headers['content-type']).toMatch(/javascript/)
  expect(brotli.body.equals(readFileSync(`${built(src!)}.br`))).toBe(true)

  const gzip = await fetchRaw(url, { 'accept-encoding': 'gzip' })
  expect(gzip.status).toBe(200)
  expect(gzip.headers['content-encoding']).toBe('gzip')
  expect(gzip.body.equals(readFileSync(`${built(src!)}.gz`))).toBe(true)

  const identity = await fetchRaw(url, { 'accept-encoding': 'identity' })
  expect(identity.status).toBe(200)
  expect(identity.headers['content-encoding']).toBeUndefined()
  expect(identity.body.equals(readFileSync(built(src!)))).toBe(true)
})

// The playground's files, as the build wrote them
const playground = JSON.parse(readFileSync('.playground/manifest.json', 'utf8')) as {
  swc: string
  lines: { runtime: string }[]
}

test("the playground's runtime and compiler go out compressed, the compiler as WebAssembly a browser compiles as it streams", async ({
  baseURL,
}) => {
  for (const [asset, type] of [
    [playground.swc, /^application\/wasm$/],
    [playground.lines[0].runtime, /javascript/],
  ] as const) {
    const url = new URL(asset, baseURL).toString()
    const source = readFileSync(path.join('public', asset))
    for (const [accept, encoding, decode] of [
      ['gzip, deflate, br, zstd', 'br', brotliDecompressSync],
      ['gzip', 'gzip', gunzipSync],
    ] as const) {
      const response = await fetchRaw(url, { 'accept-encoding': accept })
      expect(response.status, asset).toBe(200)
      expect(response.headers['content-encoding'], asset).toBe(encoding)
      expect(response.headers['content-type'], asset).toMatch(type)
      expect(response.headers.vary, asset).toMatch(/accept-encoding/i)
      expect(response.headers['cache-control'], asset).toBe('public, max-age=31536000, immutable')
      expect(response.headers['access-control-allow-origin'], asset).toBe('*')
      expect(Number(response.headers['content-length']), asset).toBe(response.body.byteLength)
      expect(response.body.byteLength, asset).toBeLessThan(source.byteLength / 3)
      expect(decode(response.body).equals(source), asset).toBe(true)
    }
    const identity = await fetchRaw(url, { 'accept-encoding': 'identity' })
    expect(identity.headers['content-type'], asset).toMatch(type)
    expect(identity.body.equals(source), asset).toBe(true)
  }
})

/** A response over HTTP/2 from `origin`, its bytes as sent; the hop's certificate is made for the run. */
function fetchH2(origin: string, path: string, headers: Record<string, string>) {
  return new Promise<{ headers: http2.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const client = http2.connect(origin, { rejectUnauthorized: false })
    client.on('error', reject)
    const request = client.request({ ':path': path, ...headers })
    const chunks: Buffer[] = []
    let head: http2.IncomingHttpHeaders = {}
    request.on('response', received => (head = received))
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      client.close()
      resolve({ headers: head, body: Buffer.concat(chunks) })
    })
    request.on('error', reject)
    request.end()
  })
}

test('the edge hop the performance spec measures through delivers a script its browser can decode', async ({
  page,
  baseURL,
}) => {
  await page.goto('/docs/4.1/defer')
  const src = await page.locator('script[src^="/_next/static/chunks/"]:not([nomodule])').first().getAttribute('src')
  const source = readFileSync(built(src!))
  const hop = await edgeHop(baseURL!, e2ePort() + 4)
  try {
    // The server sends this script's brotli copy; the hop passes those bytes on as they are.
    const brotli = await fetchH2(hop.origin, src!, { 'accept-encoding': 'gzip, deflate, br, zstd' })
    expect(brotli.headers['content-encoding']).toBe('br')
    expect(brotliDecompressSync(brotli.body).equals(source)).toBe(true)
    // Without brotli, the server sends the script's gzip copy, and the hop passes it on.
    const gzip = await fetchH2(hop.origin, src!, { 'accept-encoding': 'gzip' })
    expect(gzip.headers['content-encoding']).toBe('gzip')
    expect(gunzipSync(gzip.body).equals(source)).toBe(true)
  } finally {
    await hop.close()
  }
})
