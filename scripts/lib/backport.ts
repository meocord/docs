/** Re-targets a commit's changes to one line's content at another line. */

/** Rewrites a unified diff's paths from `content/<from>/` to `content/<to>/`, dropping every other file. */
export function retargetDiff(diff: string, from: string, to: string): string {
  const source = `content/${from}/`
  const target = `content/${to}/`
  const files = diff.split(/(?=^diff --git )/m).filter(part => part.startsWith('diff --git '))
  return files
    .filter(part => part.split('\n', 1)[0].includes(` a/${source}`))
    .map(part =>
      part
        .split('\n')
        // Blob hashes name the source line's files, so a three-way merge against them would be wrong
        .filter(line => !line.startsWith('index '))
        .map(line => (/^(diff --git|--- |\+\+\+ |rename (from|to) )/.test(line) ? line.split(source).join(target) : line))
        .join('\n'),
    )
    .join('')
}

/** The single line whose content a diff touches, or an error naming what it touches. */
export function sourceLine(diff: string): string {
  const lines = new Set([...diff.matchAll(/^diff --git a\/content\/([^/]+)\//gm)].map(match => match[1]))
  if (lines.size !== 1) throw new Error(lines.size === 0 ? 'The commit changes no content.' : `The commit changes the content of ${[...lines].join(', ')}; backport one line's changes.`)
  return [...lines][0]
}
