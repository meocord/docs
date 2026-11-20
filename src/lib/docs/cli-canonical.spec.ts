import { describe, expect, it, vi } from 'vitest'
import * as api from '@/app/docs/[line]/api/[...path]/page'
import { cliCommand, cliManifest } from '@/lib/docs/cli-site'
import { lineVersions } from '@/lib/docs/api-site'

// A line whose newest version drops a command its older versions ship, which no published version does yet
const LINE = '4.1'
const DROPPED = 'generate'

// The version whose manifest drops the command, set once the line's newest version is known
const dropping = vi.hoisted(() => ({ version: '' }))

vi.mock('@/lib/docs/cli-site', async original => {
  const site = await original<typeof import('@/lib/docs/cli-site')>()
  return {
    ...site,
    cliManifest: (version: string | undefined) => {
      const manifest = site.cliManifest(version)
      return manifest && version === dropping.version
        ? { ...manifest, commands: manifest.commands.filter(command => command.name !== DROPPED) }
        : manifest
    },
  }
})

const params = <T>(value: T) => ({ params: Promise.resolve(value) }) as never

describe('an exact version’s CLI page', () => {
  it('has no canonical when the line’s newest version dropped its command', async () => {
    const newest = (dropping.version = lineVersions(LINE)[0]!)
    const older = lineVersions(LINE).find(version => {
      const manifest = cliManifest(version)
      return version !== newest && !!manifest && !!cliCommand(manifest, DROPPED)
    })!
    expect(cliCommand(cliManifest(newest)!, DROPPED)).toBeUndefined()
    const meta = await api.generateMetadata(params({ line: LINE, path: [older, 'cli', DROPPED] }))
    expect(meta.title).toEqual({ absolute: expect.stringContaining(`meocord ${DROPPED} · CLI ${older}`) })
    expect(meta.alternates?.canonical).toBeUndefined()
  })
})
