import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { codeFrame, packageManagerVariants } from '@/lib/prose/code'

const html = (...args: Parameters<typeof codeFrame>) => renderToStaticMarkup(codeFrame(...args).render())

describe('packageManagerVariants', () => {
  it('writes npm and npx commands for each package manager, keeping comments', () => {
    expect(
      packageManagerVariants('npx meocord create app   # a new bot\nnpm install -D vitest\nnpm run build'),
    ).toEqual({
      npm: 'npx meocord create app   # a new bot\nnpm install -D vitest\nnpm run build',
      bun: 'bunx meocord create app   # a new bot\nbun add -d vitest\nbun run build',
      pnpm: 'pnpm dlx meocord create app   # a new bot\npnpm add -D vitest\npnpm build',
      yarn: 'yarn dlx meocord create app   # a new bot\nyarn add -D vitest\nyarn build',
    })
    expect(packageManagerVariants('# comment only\nnpm i discord.js')?.bun).toBe('# comment only\nbun add discord.js')
  })

  it('leaves a block alone when any command has no equivalent', () => {
    expect(packageManagerVariants('npx meocord build\ndocker build .')).toBeUndefined()
    expect(packageManagerVariants('yarn install --production')).toBeUndefined()
    expect(packageManagerVariants('')).toBeUndefined()
  })
})

describe('codeFrame', () => {
  it('names the language, highlights, and offers a copy button', () => {
    const out = html("const a = 'b'", 'typescript')
    expect(out).toContain('<span>TypeScript</span>')
    expect(out).toContain('data-copy="true"')
    expect(out).toMatch(/--code-dark:#[0-9A-F]{6};--code-light:#[0-9A-F]{6}/)
  })

  it('names the file when the code comes from one', () => {
    expect(html('x', 'ts', { file: 'app.ts' })).toContain('<span data-file="true">app.ts</span>')
  })

  it('draws unmarked and plain code without colour', () => {
    expect(html('plain', undefined)).toContain('<code>plain</code>')
    expect(html('plain', 'text')).toContain('<span>text</span>')
  })

  it('gives install commands a tab and a pane per package manager', () => {
    const out = html('npx meocord create app', 'shell')
    for (const pm of ['npm', 'bun', 'pnpm', 'yarn']) {
      expect(out).toContain(`data-pm-choice="${pm}"`)
      expect(out).toContain(`data-pm-pane="${pm}"`)
    }
    expect(out).toContain('data-install="true"')
  })
})
