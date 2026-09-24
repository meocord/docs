import { describe, expect, it, vi } from 'vitest'
import { GET as og } from '@/app/og/[line]/[file]/route'
import { ogPath } from '@/lib/og/cards'
import { renderCard } from '@/lib/og/render'

// cacheLife is inert outside a Next build; the drawing is what is under test.
vi.mock('next/cache', () => ({ cacheLife: () => undefined }))

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('renderCard', () => {
  it('draws a 1200×630 PNG, with and without a version', async () => {
    for (const card of [
      { eyebrow: 'Guide', title: 'Deferring replies' },
      { eyebrow: 'API', title: 'MeoCordApp', version: '4.1' },
    ]) {
      const { png: base64, engine } = await renderCard(card)
      expect(['gpu', 'cpu']).toContain(engine)
      const png = Buffer.from(base64, 'base64')
      expect(png.subarray(0, 8)).toEqual(PNG)
      expect(png.readUInt32BE(16)).toBe(1200)
      expect(png.readUInt32BE(20)).toBe(630)
    }
  })
})

describe('og route', () => {
  it('serves the current hash as an immutable, noindexed PNG', async () => {
    const [, , line, file] = ogPath('site', 'home').split('/')
    const response = await og(new Request('https://docs.test'), { params: Promise.resolve({ line, file }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(response.headers.get('X-Rasteriser')).toMatch(/^(gpu|cpu)$/)
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 8)).toEqual(PNG)
  })
})
