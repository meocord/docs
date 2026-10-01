/**
 * What a Playwright JSON report says ran. CI fails when a spec that must run in every build reports a test
 * skipped, left unrun, or no test at all, so a spec that quietly stops running, as one gated on a build flag
 * did, shows in the job rather than as a smaller total.
 */

/** The specs that must run every test in every CI build, by file name under e2e/. */
export const MUST_RUN = ['live-routes.spec.ts', 'playground-frame.spec.ts']

interface ReportTest {
  projectName: string
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped'
  results: { status: string }[]
}
interface ReportSpec {
  title: string
  file: string
  tests: ReportTest[]
}
interface ReportSuite {
  title: string
  file: string
  specs?: ReportSpec[]
  suites?: ReportSuite[]
}
export interface Report {
  suites: ReportSuite[]
  stats?: { expected: number; unexpected: number; flaky: number; skipped: number }
}

/** Every test in a report, with the spec file and title it belongs to. */
export function testsOf(report: Report): { file: string; title: string; test: ReportTest }[] {
  const found: { file: string; title: string; test: ReportTest }[] = []
  const walk = (suite: ReportSuite) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests) found.push({ file: spec.file, title: spec.title, test })
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of report.suites) walk(suite)
  return found
}

/** Why the report doesn't show each must-run spec running every test, one line per problem. */
export function mustRunProblems(report: Report, mustRun: readonly string[] = MUST_RUN): string[] {
  const tests = testsOf(report)
  return mustRun.flatMap(file => {
    const own = tests.filter(entry => entry.file === file || entry.file.endsWith(`/${file}`))
    if (own.length === 0) return [`e2e/${file} ran no test: it is missing from the run`]
    return own.flatMap(({ title, test }) =>
      test.status === 'skipped'
        ? [`e2e/${file} › ${title} [${test.projectName}] was skipped`]
        : test.results.length === 0 || test.results.every(result => result.status === 'interrupted')
          ? [`e2e/${file} › ${title} [${test.projectName}] did not run`]
          : [],
    )
  })
}
