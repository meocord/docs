import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CliCommand } from '../../../scripts/lib/cli'
import { cliArticle } from '@/lib/docs/api-render'
import { cliManifest, exampleInvocation } from '@/lib/docs/cli-site'

// The CLI of the version the 4.1 examples pin, which the site's newest CLI pages describe
const pkgDir = realpathSync('examples/4.1/node_modules/meocord')
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as { version: string; bin: string }
const bin = path.join(pkgDir, pkg.bin)
const manifest = cliManifest(pkg.version)

/** The part of commander's `Command` this spec drives. */
interface Program {
  commands: Program[]
  exitOverride(): Program
  configureOutput(output: { writeOut: (text: string) => void; writeErr: (text: string) => void }): Program
  action(handler: () => void): Program
  parseAsync(argv: string[], options: { from: 'user' }): Promise<unknown>
}

let newProgram: () => Program

// The real CLI's commands and options, each command's action replaced, so parsing runs and nothing else
async function parses(example: string): Promise<string | undefined> {
  const errors: string[] = []
  const parseOnly = (command: Program) => {
    command.exitOverride().configureOutput({ writeOut: () => {}, writeErr: text => errors.push(text) })
    if (command.commands.length === 0) command.action(() => {})
    command.commands.forEach(parseOnly)
  }
  const program = newProgram()
  parseOnly(program)
  try {
    await program.parseAsync(example.split(' ').slice(1), { from: 'user' })
    return undefined
  } catch (error) {
    return errors.join('') || String(error)
  }
}

const everyCommand = (command: CliCommand): CliCommand[] => [command, ...command.commands.flatMap(everyCommand)]
const examples = [...new Set((manifest?.commands ?? []).flatMap(everyCommand).map(exampleInvocation))]
// Commands that only print, or write into the working directory, run in full; the rest would install, build or log in
const runs = (example: string) => ['show', 'generate'].includes(example.split(' ')[1]!)
const dirs: string[] = []

describe("the CLI reference's examples, against the CLI they describe", () => {
  beforeAll(async () => {
    const { MeoCordCLI } = (await import(pathToFileURL(bin).href)) as { MeoCordCLI: new () => { program(): Program } }
    newProgram = () => new MeoCordCLI().program()
  })
  afterAll(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('has a manifest for the pinned version, and every example is on its page, with no placeholder', () => {
    expect(manifest?.meocordVersion).toBe(pkg.version)
    for (const command of manifest!.commands) {
      const text = renderToStaticMarkup(Div({ children: cliArticle(command).nodes }).render())
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;|&#x3C;/g, '<')
        .replace(/&gt;/g, '>')
      for (const each of everyCommand(command)) expect(text).toContain(exampleInvocation(each))
    }
    expect(examples.filter(example => /[<>[\]]/.test(example))).toEqual([])
  })

  it.each(examples)('%s parses', async example => {
    expect(await parses(example)).toBeUndefined()
  })

  // Each starts the CLI as a process of its own, which takes a few seconds on a busy machine
  it.concurrent.for(examples.filter(runs))('%s runs in a project', { timeout: 30_000 }, async (example, { expect }) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'meocord-cli-example-'))
    dirs.push(dir)
    writeFileSync(path.join(dir, 'package.json'), '{ "name": "example", "private": true }\n')
    const run = promisify(execFile)(process.execPath, [bin, ...example.split(' ').slice(1)], { cwd: dir })
    await expect(
      run.then(
        () => 0,
        (error: { code?: number; stderr?: string }) => error.stderr || error.code,
      ),
    ).resolves.toBe(0)
  })
})
