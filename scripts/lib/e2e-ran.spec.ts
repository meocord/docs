import { describe, expect, it } from 'vitest'
import { mustRunProblems, type Report } from './e2e-ran'

const test = (
  projectName: string,
  status: 'expected' | 'skipped' | 'flaky' | 'unexpected',
  results = [{ status: 'passed' }],
) => ({
  projectName,
  status,
  results,
})
const report = (file: string, tests: ReturnType<typeof test>[]): Report => ({
  suites: [{ title: file, file, specs: [{ title: 'does its thing', file, tests }] }],
})

describe('mustRunProblems', () => {
  it('passes a must-run spec whose tests ran, flaky ones included', () => {
    expect(
      mustRunProblems(report('a.spec.ts', [test('chromium', 'expected'), test('firefox', 'flaky')]), ['a.spec.ts']),
    ).toEqual([])
  })

  it('names a skipped test, a test that did not run, and a spec missing from the run', () => {
    const run = report('a.spec.ts', [
      test('chromium', 'skipped', [{ status: 'skipped' }]),
      test('webkit', 'expected', []),
      test('firefox', 'expected', [{ status: 'interrupted' }]),
    ])
    expect(mustRunProblems(run, ['a.spec.ts', 'b.spec.ts'])).toEqual([
      'e2e/a.spec.ts › does its thing [chromium] was skipped',
      'e2e/a.spec.ts › does its thing [webkit] did not run',
      'e2e/a.spec.ts › does its thing [firefox] did not run',
      'e2e/b.spec.ts ran no test: it is missing from the run',
    ])
  })

  it('finds a spec in a nested suite', () => {
    const run: Report = {
      suites: [
        {
          title: 'a.spec.ts',
          file: 'a.spec.ts',
          suites: [
            {
              title: 'group',
              file: 'a.spec.ts',
              specs: [{ title: 't', file: 'a.spec.ts', tests: [test('chromium', 'skipped', [{ status: 'skipped' }])] }],
            },
          ],
        },
      ],
    }
    expect(mustRunProblems(run, ['a.spec.ts'])).toEqual(['e2e/a.spec.ts › t [chromium] was skipped'])
  })
})
