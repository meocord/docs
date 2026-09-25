/** Formats what the pipeline wrote with the repository's Prettier config, so its output passes format:check. */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import path from 'path'
import { format, resolveConfig } from 'prettier'

function filesUnder(target: string): string[] {
  if (!existsSync(target)) return []
  if (!statSync(target).isDirectory()) return [target]
  return readdirSync(target).flatMap(name => filesUnder(path.join(target, name)))
}

export async function formatFiles(targets: string[]): Promise<void> {
  for (const file of targets.flatMap(filesUnder).filter(name => /\.(md|json)$/.test(name))) {
    const text = readFileSync(file, 'utf8')
    const formatted = await format(text, { ...(await resolveConfig(file)), filepath: file })
    if (formatted !== text) writeFileSync(file, formatted)
  }
}
