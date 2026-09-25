/**
 * Formats the reference's long code with Prettier, as TypeScript: each declaration, member, return
 * type and parameter type that does not fit its width, keyed for the pages to look up.
 */

import { format } from 'prettier'
import type { ApiModel, ApiSignature, Token } from '../../src/lib/docs/api-model.js'
import { LAYOUT_WIDTH, layoutKey, unwrap, wrap, type LayoutForm, type Layouts } from '../../src/lib/docs/api-layout.js'

const text = (tokens: Token[]) => tokens.map(token => token.text).join('')

// Stand-ins for what TypeScript cannot parse: TypeDoc's `...` for a type it stopped expanding, as an
// identifier of the same width, and a constructor shown as `new Name(...)`, as `constructor(...)`.
const ELIDED = /\.\.\.(?![\w$([{])/g
const CONSTRUCTOR = /^new ([\w$]+)\(/

/** The display formatted to its form's width, or undefined when it fits or Prettier cannot read it. */
export async function formatDisplay(form: LayoutForm, display: string): Promise<string | undefined> {
  if (display.includes('\n') || display.includes('$$$')) return undefined
  if (display.length <= LAYOUT_WIDTH[form]) return undefined
  const { source } = wrap(form, display)
  const constructed = form === 'member' ? CONSTRUCTOR.exec(display)?.[1] : undefined
  let parsed = source.replace(ELIDED, '$$$$$$')
  if (constructed) parsed = parsed.replace(`new ${constructed}(`, 'constructor(')
  try {
    const formatted = await format(parsed, {
      parser: 'typescript',
      printWidth: LAYOUT_WIDTH[form],
      semi: false,
      singleQuote: true,
      trailingComma: 'all',
      arrowParens: 'avoid',
    })
    let restored = formatted.replaceAll('$$$', '...')
    if (constructed) restored = restored.replace(/^( *)constructor\(/m, `$1new ${constructed}(`)
    const result = unwrap(form, display, restored)
    return result === display ? undefined : result
  } catch {
    return undefined
  }
}

/** Every display on a model's pages, by form. */
function displays(model: ApiModel): [LayoutForm, string][] {
  const out: [LayoutForm, string][] = []
  const signature = (each: ApiSignature) => {
    if (each.returns) out.push(['returns', text(each.returns.type)])
    for (const param of each.params) if (param.type.length > 0) out.push(['param', text(param.type)])
  }
  for (const { entry, symbol: name } of model.params()) {
    const symbol = model.symbol(entry, name)
    if (!symbol) continue
    for (const line of symbol.code) out.push(['declaration', text(line)])
    symbol.signatures.forEach(signature)
    for (const member of symbol.members) {
      for (const line of member.code) out.push(['member', text(line)])
      member.signatures.forEach(signature)
    }
  }
  return out
}

/** The formatted layout of every display on a model's pages that runs past its width. */
export async function modelLayouts(model: ApiModel): Promise<Layouts> {
  const layouts: Layouts = {}
  for (const [form, display] of displays(model)) {
    const key = layoutKey(form, display)
    if (key in layouts) continue
    const formatted = await formatDisplay(form, display)
    if (formatted !== undefined) layouts[key] = formatted
  }
  return layouts
}
