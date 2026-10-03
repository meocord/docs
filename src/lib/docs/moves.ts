import { permanentRedirect, redirect } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { permanentMove } from '@/lib/cache-policy'

/**
 * Sends the reader to where a page is now: permanently only where the mapping can never change, and temporarily from
 * the current line, whose pages a reader reaches through `latest`, which reaches another line once the current one
 * changes.
 */
export function moveTo(href: string, move: 'exact-version' | 'line-page', line: string): never {
  const current = VERSIONS.lines.find(entry => entry.line === line)?.status === 'current'
  return permanentMove(move, current) ? permanentRedirect(href) : redirect(href)
}
