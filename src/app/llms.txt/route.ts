import { CURRENT_LINE } from '@/config/versions'
import { llmsIndex } from '@/lib/docs/llms'
import { llmsResponse } from '@/lib/docs/llms-response'

/** The current line's docs as a list of links for language models, per llmstxt.org. */
export function GET() {
  return llmsResponse(llmsIndex(CURRENT_LINE))
}
