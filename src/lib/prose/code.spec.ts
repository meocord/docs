import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { codeFrame, packageManagerVariants } from '@/lib/prose/code'

const html = (...args: Parameters<typeof codeFrame>) => renderToStaticMarkup(codeFrame(...args).render())

describe('packageManagerVariants', () => {
  it('writes npm and npx commands for each package manager, keeping comments', () => {
    expect(packageManagerVariants('npx meocord create app # a new bot\nnpm install -D vitest\nnpm run build')).toEqual({
      npm: 'npx meocord create app # a new bot\nnpm install -D vitest\nnpm run build',
      bun: 'bunx meocord create app # a new bot\nbun add -d vitest\nbun run build',
      pnpm: 'pnpm dlx meocord create app # a new bot\npnpm add -D vitest\npnpm build',
      yarn: 'yarn dlx meocord create app # a new bot\nyarn add -D vitest\nyarn build',
    })
    expect(packageManagerVariants('# comment only\nnpm i discord.js')?.bun).toBe('# comment only\nbun add discord.js')
  })

  it("runs a project's own command with its local install, and only a versioned package or create as a one-off", () => {
    expect(packageManagerVariants('npx meocord start --dev')).toEqual({
      npm: 'npx meocord start --dev',
      bun: 'bunx meocord start --dev',
      pnpm: 'pnpm exec meocord start --dev',
      yarn: 'yarn meocord start --dev',
    })
    expect(packageManagerVariants('npx meocord@beta create my-bot')?.pnpm).toBe('pnpm dlx meocord@beta create my-bot')
    expect(packageManagerVariants('npx meocord create my-bot')?.yarn).toBe('yarn dlx meocord create my-bot')
  })

  it('leaves a block alone when any package-manager command has no equivalent', () => {
    expect(packageManagerVariants('npx meocord build\nnpm publish')).toBeUndefined()
    expect(packageManagerVariants('yarn install --production')).toBeUndefined()
    expect(packageManagerVariants('npm ci --ignore-scripts')).toBeUndefined()
    expect(packageManagerVariants('')).toBeUndefined()
  })

  it('keeps the lines no package manager runs as written in every tab', () => {
    const neutral = '\ngit clone https://github.com/meocord/examples.git\ncd my-bot\ncp .env.example .env'
    expect(packageManagerVariants(`npx meocord create my-bot${neutral}`)).toEqual({
      npm: `npx meocord create my-bot${neutral}`,
      bun: `bunx meocord create my-bot${neutral}`,
      pnpm: `pnpm dlx meocord create my-bot${neutral}`,
      yarn: `yarn dlx meocord create my-bot${neutral}`,
    })
  })

  it('gives no tabs to a block that runs no package manager', () => {
    expect(packageManagerVariants('cd my-bot\ncp .env.example .env')).toBeUndefined()
    expect(packageManagerVariants('docker run --env-file .env my-bot')).toBeUndefined()
  })

  it('leaves a block alone when a package-manager command without an equivalent sits beside other commands', () => {
    expect(packageManagerVariants('cd my-bot\nnpm publish')).toBeUndefined()
    expect(packageManagerVariants('cd my-bot && npm publish')).toBeUndefined()
    expect(packageManagerVariants('cd my-bot; npm publish')).toBeUndefined()
    for (const other of [
      'npx',
      'pnpm install',
      'yarn install',
      'bun install',
      'bunx tsc',
      'NODE_ENV=production npm publish',
    ])
      expect(packageManagerVariants(`npx meocord build\n${other}`)).toBeUndefined()
  })

  it('converts each command chained in one line', () => {
    expect(packageManagerVariants('npm ci && npx meocord build --prod')).toEqual({
      npm: 'npm ci && npx meocord build --prod',
      bun: 'bun ci && bunx meocord build --prod',
      pnpm: 'pnpm install --frozen-lockfile && pnpm exec meocord build --prod',
      yarn: 'yarn install --immutable && yarn meocord build --prod',
    })
    expect(packageManagerVariants('cd my-bot; npm run build')?.pnpm).toBe('cd my-bot; pnpm build')
  })

  it('installs from the lockfile as npm ci does', () => {
    expect(packageManagerVariants('npm ci')).toEqual({
      npm: 'npm ci',
      bun: 'bun ci',
      pnpm: 'pnpm install --frozen-lockfile',
      yarn: 'yarn install --immutable',
    })
  })

  it('installs only the production dependencies, dropping the development ones already installed', () => {
    expect(packageManagerVariants('npm ci --omit=dev')).toEqual({
      npm: 'npm ci --omit=dev',
      bun: 'bun install --production && bun prune --production',
      pnpm: 'pnpm install --frozen-lockfile --prod',
      yarn: 'yarn workspaces focus --all --production',
    })
  })

  it("runs the project's test script, never Bun's own test runner", () => {
    expect(packageManagerVariants('npm test # once')).toEqual({
      npm: 'npm test # once',
      bun: 'bun run test # once',
      pnpm: 'pnpm test # once',
      yarn: 'yarn test # once',
    })
    expect(packageManagerVariants('npm test')?.bun).not.toBe('bun test')
  })

  it('reads a command after the environment variables it is given', () => {
    expect(packageManagerVariants('MEOCORD_RUNTIME=/usr/local/bin/bun npm run start:prod')).toEqual({
      npm: 'MEOCORD_RUNTIME=/usr/local/bin/bun npm run start:prod',
      bun: 'MEOCORD_RUNTIME=/usr/local/bin/bun bun run start:prod',
      pnpm: 'MEOCORD_RUNTIME=/usr/local/bin/bun pnpm start:prod',
      yarn: 'MEOCORD_RUNTIME=/usr/local/bin/bun yarn start:prod',
    })
  })

  it('leaves a comment as written, whatever it names', () => {
    expect(packageManagerVariants('npm run build   # then && npm ci')?.bun).toBe('bun run build   # then && npm ci')
  })

  it('keeps comments aligned to a column in that column, at least a blank past the command', () => {
    const block =
      'npm test                # once\nnpm run test:watch      # on every change\nnpm run test:coverage   # with a report'
    const variants = packageManagerVariants(block)!
    for (const pm of ['bun', 'pnpm', 'yarn'] as const)
      expect(variants[pm].split('\n').map(line => line.indexOf('#'))).toEqual([24, 24, 24])
    expect(variants.bun.split('\n')[0]).toBe('bun run test            # once')
    expect(packageManagerVariants('npx meocord create my-bot-with-a-long-name  # here')?.pnpm).toBe(
      'pnpm dlx meocord create my-bot-with-a-long-name # here',
    )
    // An indented comment line is not aligned to anything, and stays where it is
    expect(packageManagerVariants('  # first\nnpx meocord create my-bot-with-a-long-name  # here')?.pnpm).toBe(
      '  # first\npnpm dlx meocord create my-bot-with-a-long-name # here',
    )
    // A converted command past the column moves every aligned comment with it
    expect(
      packageManagerVariants('cp .env.example .env         # a token\nnpx meocord start --dev      # watch')?.pnpm,
    ).toBe('cp .env.example .env          # a token\npnpm exec meocord start --dev # watch')
  })

  it('leaves a block alone when a package manager runs other than at the start of a command', () => {
    for (const other of [
      'sudo npm install -g meocord',
      'env NODE_ENV=production npm run start',
      'FOO="a b" npm run start',
      'echo $(npm run version)',
      'echo `npm run version`',
      'npx cross-env NODE_ENV=production npm run build',
      'bash -c "npm run build"',
      "sh -c 'npm test'",
    ])
      expect(packageManagerVariants(`npm ci\n${other}`)).toBeUndefined()
  })

  it('leaves a block alone when a line naming a package manager has a separator or # inside quotes', () => {
    expect(packageManagerVariants('npm ci\ngit commit -m "x && npm run y"')).toBeUndefined()
    expect(packageManagerVariants("npm ci\ngit commit -m 'x && npm run y'")).toBeUndefined()
    expect(packageManagerVariants('npm ci\necho "a; b" && npm run build')).toBeUndefined()
    expect(packageManagerVariants('npm ci\necho "a #b" && npm run build')).toBeUndefined()
  })

  it('converts a command whose quoted arguments hold no separator', () => {
    expect(packageManagerVariants('npm install --save-dev "typescript@>=4.8.4 <6.1" globals')?.bun).toBe(
      'bun add -d "typescript@>=4.8.4 <6.1" globals',
    )
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

  it('draws its icons as plain SVG, sized by attributes and with no class', () => {
    const icons = [...html('x', 'ts').matchAll(/<svg data-icon="[^"]*"[^>]*>/g)].map(([tag]) => tag)
    expect(icons).toHaveLength(2)
    for (const tag of icons) {
      expect(tag).toContain(' width="16"')
      expect(tag).toContain(' height="16"')
      expect(tag).not.toContain(' class=')
    }
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
