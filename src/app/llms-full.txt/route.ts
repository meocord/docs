import { CURRENT_LINE } from '@/config/versions'
import { llmsFull } from '@/lib/docs/llms'
import { llmsResponse } from '@/lib/docs/llms-response'

/** The current line's whole Guide as one Markdown file, for a language model to read at once. */
export function GET() {
  return llmsResponse(llmsFull(CURRENT_LINE))
}
