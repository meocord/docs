import { gzipSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import { BUDGET_BYTES, gzipSize, LISTED, measure, pageScripts, report } from './js-budget.js'

describe('pageScripts', () => {
  it('lists each same-origin script once, in order, without the nomodule polyfill', () => {
    const html = [
      '<script src="/_next/static/chunks/a.js" async=""></script>',
      '<script src="/_next/static/chunks/polyfills.js" noModule=""></script>',
      '<script src="https://example.com/x.js"></script>',
      '<script>inline()</script>',
      '<script src="/_next/static/chunks/b.js" id="_R_" async=""></script>',
      '<script src="/_next/static/chunks/a.js" async=""></script>',
    ].join('')
    expect(pageScripts(html)).toEqual(['/_next/static/chunks/a.js', '/_next/static/chunks/b.js'])
  })
})

describe('measure and report', () => {
  const files: Record<string, Uint8Array> = {
    '/_next/a.js': new TextEncoder().encode('a'.repeat(5000)),
    '/_next/b.js': new Uint8Array(4000).map((_, i) => (i * 7919) % 251),
  }
  const pages = {
    '/': '<script src="/_next/a.js"></script><script src="/_next/b.js"></script>',
    '/docs/latest': '<script src="/_next/a.js"></script>',
  }

  it('sums the gzipped scripts of each page, heaviest page and chunk first', () => {
    const results = measure(pages, src => files[src])
    expect(results.map(result => result.page)).toEqual(['/', '/docs/latest'])
    expect(results[0].total).toBe(gzipSize(files['/_next/a.js']) + gzipSize(files['/_next/b.js']))
    expect(results[0].chunks[0].src).toBe('/_next/b.js')
    expect(gzipSize(files['/_next/a.js'])).toBe(gzipSync(files['/_next/a.js']).byteLength)
  })

  it('reads each script once however many pages load it', () => {
    let reads = 0
    measure(pages, src => {
      reads += 1
      return files[src]
    })
    expect(reads).toBe(2)
  })

  it('passes under the budget and lists the chunks of the heaviest page', () => {
    const { text, over } = report(measure(pages, src => files[src]))
    expect(over).toEqual([])
    expect(text).toContain('budget 220.0 KB: 2 pages, 0 over.')
    expect(text).toContain('The heaviest 2:')
    expect(text).toMatch(/ok +\/ +0\.4 KB {2}\(2 scripts\)/)
    expect(text).toContain('(1 script)')
    expect(text).toContain('Chunks of /:')
  })

  it('fails a page over the budget and lists its chunks', () => {
    const { text, over } = report(
      measure(pages, src => files[src]),
      30,
    )
    expect(over.map(result => result.page)).toEqual(['/', '/docs/latest'])
    expect(text).toContain('Over the budget:')
    expect(text).toContain('OVER  /docs/latest')
    expect(text).toContain('Chunks of /docs/latest:')
  })

  it('lists only the heaviest pages when all are within the budget', () => {
    const many = Object.fromEntries(Array.from({ length: LISTED + 5 }, (_, i) => [`/p${i}`, pages['/']]))
    const { text } = report(measure(many, src => files[src]))
    expect(text).toContain(`${LISTED + 5} pages, 0 over.`)
    expect(text.split('\n').filter(line => line.startsWith('  ok')).length).toBe(LISTED)
  })

  it('holds the budget the site agreed on', () => {
    expect(BUDGET_BYTES).toBe(220_000)
  })
})
