import { readFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { expect, test } from '@playwright/test'

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

test('a page’s scripts go out as their brotli copies to a browser that takes brotli, and as themselves to one that does not', async ({
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

  const identity = await fetchRaw(url, { 'accept-encoding': 'gzip' })
  expect(identity.status).toBe(200)
  expect(identity.headers['content-encoding']).toBeUndefined()
  expect(identity.body.equals(readFileSync(built(src!)))).toBe(true)
})
