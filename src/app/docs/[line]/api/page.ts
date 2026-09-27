import { notFound, redirect } from 'next/navigation'
import { apiLandingHref } from '@/lib/docs/api-site'
import { lines } from '@/lib/docs/site'

type Params = { params: Promise<{ line: string }> }

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// line, which must answer a real 404 rather than stream a shell. See the `instant` docs.
export const instant = false

export function generateStaticParams() {
  return lines()
    .filter(line => apiLandingHref(line) !== undefined)
    .map(line => ({ line }))
}

// A line's API reference opens where the sidebar's API tab opens it
export default async function ApiPage({ params }: Params) {
  const { line } = await params
  const href = apiLandingHref(line)
  if (!href) notFound()
  redirect(href)
}
