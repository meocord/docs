/**
 * A declaration's default as Markdown, whether its `@defaultValue` tag wrote it or its parameter's initializer did.
 */

/**
 * The block TypeDoc makes of a `@defaultValue` tag written with no code span in it, as JSDoc's `@default` takes a
 * bare value: the whole tag in a `ts` fence.
 */
const TYPEDOC_DEFAULT_FENCE = /^```\w*\n([\s\S]*?)\n```$/

/**
 * A `@defaultValue` tag's text as Markdown. A tag TypeDoc fenced is written as prose in the declarations, such as
 * `@defaultValue every type`, so it reads as the prose it was written as; a code span stays a code span.
 */
export function defaultMarkdown(text: string): string {
  return text.replace(TYPEDOC_DEFAULT_FENCE, '$1')
}

/** Code, such as a parameter's initializer, as one Markdown code span, however many backticks it holds. */
export function codeSpan(code: string): string {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map(run => run.length))
  const fence = '`'.repeat(longest + 1)
  // A span that starts or ends with a backtick is padded, and CommonMark takes one space off each side
  const pad = code.startsWith('`') || code.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${code}${pad}${fence}`
}
