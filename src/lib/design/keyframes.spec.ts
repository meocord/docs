import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** A keyframes rule in a component's css: Emotion keeps its name as written, global to the page */
const KEYFRAMES = /['"]@keyframes ([\w-]+)['"]/g

/** Every keyframes name the source defines, with the files defining it */
function keyframesNames(): Map<string, string[]> {
  const names = new Map<string, string[]>()
  const files = readdirSync(SOURCE, { recursive: true, encoding: 'utf8' }).filter(
    file => file.endsWith('.ts') && !file.endsWith('.spec.ts'),
  )
  for (const file of files) {
    for (const [, name] of readFileSync(path.join(SOURCE, file), 'utf8').matchAll(KEYFRAMES)) {
      names.set(name, [...(names.get(name) ?? []), file])
    }
  }
  return names
}

describe('keyframes', () => {
  // Two components defining one name share whichever definition the page inserted last
  it("are each defined in one file, so no component animates by another one's", () => {
    const names = keyframesNames()

    expect(names.size).toBeGreaterThan(0)
    expect([...names].filter(([, files]) => files.length > 1)).toEqual([])
  })
})
