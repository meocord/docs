/**
 * The lines the aliases point at: `latest` is the current line, `next` the one in prerelease, if any. It reads
 * only the lines, with no file system, so the site's proxy and its build checks share it.
 */
export function aliases(config: { lines: readonly { line: string; status: string }[] }): {
  latest?: string
  next?: string
} {
  return {
    latest: config.lines.find(line => line.status === 'current')?.line,
    next: config.lines.find(line => line.status === 'prerelease')?.line,
  }
}
