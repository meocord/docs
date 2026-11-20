import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const WORKFLOWS = path.join(import.meta.dirname, '..', '.github', 'workflows')

/** How GitHub runs a step's script on Linux, by its resolved `shell`; one without a shell gets no `pipefail`. */
const GITHUB_SHELLS: Record<string, string[]> = {
  bash: ['--noprofile', '--norc', '-eo', 'pipefail'],
  default: ['-e'],
}

interface Step {
  name?: string
  run?: string
  shell?: string
}
interface Workflow {
  defaults?: { run?: { shell?: string } }
  jobs: Record<string, { defaults?: { run?: { shell?: string } }; steps?: Step[] }>
}

const workflows = readdirSync(WORKFLOWS).map(file => ({
  file,
  workflow: parse(readFileSync(path.join(WORKFLOWS, file), 'utf8')) as Workflow,
}))

/** Every `run` step, with the shell GitHub resolves for it: the step's own, its job's default, then the workflow's. */
const runSteps = workflows.flatMap(({ file, workflow }) =>
  Object.entries(workflow.jobs).flatMap(([job, { defaults, steps = [] }]) =>
    steps
      .filter(step => step.run !== undefined)
      .map(step => ({
        where: `${file} ${job}: ${step.name ?? step.run}`,
        job,
        step,
        shell: step.shell ?? defaults?.run?.shell ?? workflow.defaults?.run?.shell,
      })),
  ),
)

function stepIn(job: string, matches: (step: Step) => boolean) {
  const found = runSteps.find(entry => entry.job === job && matches(entry.step))
  if (!found) throw new Error(`No step in job ${job} matches`)
  return found
}

/** Runs a step's script as GitHub would, in `cwd`, with `bin` ahead on PATH. */
function runStep({ step, shell }: ReturnType<typeof stepIn>, cwd: string, bin?: string) {
  const env = { ...process.env, PATH: bin ? `${bin}${path.delimiter}${process.env.PATH}` : process.env.PATH }
  const flags = GITHUB_SHELLS[shell ?? 'default']!
  const result = spawnSync('bash', [...flags, '-c', step.run!], { cwd, env, encoding: 'utf8' })
  return { status: result.status, output: result.stdout + result.stderr }
}

const scratch = () => mkdtempSync(path.join(tmpdir(), 'workflow-step-'))

describe('the workflows', () => {
  it('run every step under bash with pipefail, so a pipeline fails when any command in it fails', () => {
    expect(runSteps.length).toBeGreaterThan(0)
    for (const { where, shell } of runSteps) expect(shell, where).toBe('bash')
  })

  it("fail E2E's build step when the build fails, though tee succeeds, and keep its log", () => {
    const build = stepIn('e2e', step => step.run!.includes('| tee build.log'))
    const cwd = scratch()
    const bin = path.join(cwd, 'bin')
    mkdirSync(bin)
    writeFileSync(path.join(bin, 'bun'), '#!/bin/sh\necho "error: over its budget" >&2\nexit 3\n')
    chmodSync(path.join(bin, 'bun'), 0o755)

    expect(runStep(build, cwd, bin).status).not.toBe(0)
    expect(readFileSync(path.join(cwd, 'build.log'), 'utf8')).toContain('error: over its budget')
  })

  describe("E2E's meonode compiler check", () => {
    const check = () => stepIn('e2e', step => step.name === 'Check the meonode compiler ran')
    // BSD wc pads its count with spaces; GNU wc, on the runner, doesn't
    const reports = (count: number) => new RegExp(`meonode compiler markers in \\.next/server: *${count}$`, 'm')
    const withServer = (contents?: string) => {
      const cwd = scratch()
      if (contents !== undefined) {
        mkdirSync(path.join(cwd, '.next', 'server'), { recursive: true })
        writeFileSync(path.join(cwd, '.next', 'server', 'page.js'), contents)
      }
      return cwd
    }

    it('passes with markers, and counts them', () => {
      const result = runStep(check(), withServer('a __meo$: b __meo$: c'))
      expect(result).toMatchObject({ status: 0 })
      expect(result.output).toMatch(reports(2))
    })

    it('fails without markers, still reporting the count', () => {
      const result = runStep(check(), withServer('no markers'))
      expect(result.status).not.toBe(0)
      expect(result.output).toMatch(reports(0))
    })

    it('fails when there is no build to search', () => {
      expect(runStep(check(), withServer()).status).not.toBe(0)
    })
  })
})
