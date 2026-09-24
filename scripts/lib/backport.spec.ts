import { describe, expect, it } from 'vitest'
import { retargetDiff, sourceLine } from './backport.js'

const DIFF = `diff --git a/content/4.1/guards.md b/content/4.1/guards.md
index 1111111..2222222 100644
--- a/content/4.1/guards.md
+++ b/content/4.1/guards.md
@@ -1 +1 @@
-Gaurds run first.
+Guards run first.
`

describe('retargetDiff', () => {
  it('moves the paths to the other line and drops the source blob hashes', () => {
    expect(retargetDiff(DIFF, '4.1', '4.0')).toBe(`diff --git a/content/4.0/guards.md b/content/4.0/guards.md
--- a/content/4.0/guards.md
+++ b/content/4.0/guards.md
@@ -1 +1 @@
-Gaurds run first.
+Guards run first.
`)
  })

  it('leaves out files outside the source line', () => {
    expect(retargetDiff(DIFF.replaceAll('4.1', '4.2'), '4.1', '4.0')).toBe('')
  })
})

describe('sourceLine', () => {
  it('names the one line a commit changes', () => {
    expect(sourceLine(DIFF)).toBe('4.1')
    expect(() => sourceLine('')).toThrow('changes no content')
    expect(() => sourceLine(DIFF + DIFF.replaceAll('4.1', '4.0'))).toThrow('4.1, 4.0')
  })
})
