import { describe, expect, it } from 'vitest'
import { fetchMigrating, markdownAnchors, migratingFile, migratingUrl } from './migrating.js'

describe('markdownAnchors', () => {
  it('gives GitHub’s anchors, numbering repeats and skipping code', () => {
    expect(markdownAnchors('# Upgrading from 4.0 to 4.1\n## Smaller changes\n```\n# not a heading\n```\n## Smaller changes')).toEqual([
      'upgrading-from-40-to-41',
      'smaller-changes',
      'smaller-changes-1',
    ])
  })
})

describe('migratingFile', () => {
  it('records its source and points README links at the line’s pages', () => {
    const file = migratingFile('See [Guards](../README.md#guards), [the README](../README.md) and [elsewhere](../README.md#gone).', {
      line: '4.1',
      version: '4.1.0-beta.0',
      commit: 'abc',
      readmeAnchors: { guards: 'guards' },
    })

    expect(file).toBe(
      '<!-- docs/MIGRATING.md from meocord/meocord@abc (4.1.0-beta.0); generated, do not edit -->\n\nSee [Guards](/docs/4.1/guards#guards), [the README](/docs/4.1) and [elsewhere](../README.md#gone).\n',
    )
  })
})

describe('fetchMigrating', () => {
  it('reads the guide at the attested commit, and reports a failure', async () => {
    const seen: string[] = []
    const fetchImpl = async (url: string) => (seen.push(url), url.includes('good') ? new Response('# Guide') : new Response('', { status: 404 }))

    await expect(fetchMigrating('good', fetchImpl)).resolves.toBe('# Guide')
    await expect(fetchMigrating('bad', fetchImpl)).rejects.toThrow('answered 404')
    expect(seen[0]).toBe(migratingUrl('good'))
  })
})
