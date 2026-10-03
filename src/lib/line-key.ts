/**
 * The docs line a path belongs to, `latest` read as the line it stands for, so a line's pages share one key whichever
 * URL reached them: `/docs/latest/guards` and `/docs/4.1/api/4.1.0/decorators/Defer` are both 4.1 while 4.1 is current.
 * Undefined outside the docs.
 */
export function lineKey(pathname: string, latest: string): string | undefined {
  const [, section, segment] = pathname.split('/')
  if (section !== 'docs' || !segment) return undefined
  return segment === 'latest' ? latest : segment
}
