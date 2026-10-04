import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { typescriptLanguage } from '@codemirror/lang-javascript'
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  LanguageSupport,
  syntaxHighlighting,
} from '@codemirror/language'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { styleTags, Tag, tags as t } from '@lezer/highlight'
import { CODE_PALETTES } from '@/lib/prose/code-palettes'

type Token = Exclude<keyof (typeof CODE_PALETTES)['dark'], 'background'>

/** A token's colour in both modes, which globals.css picks between by `data-theme`, as for highlighted code. */
const colour = (token: Token) => ({
  '--code-dark': CODE_PALETTES.dark[token],
  '--code-light': CODE_PALETTES.light[token],
})

// A decorator's name takes the decorator colour, as `highlight` draws it, not the function's
const decoratorName = Tag.define()

const highlightStyle = HighlightStyle.define([
  { tag: t.comment, ...colour('comment'), fontStyle: 'italic' },
  {
    tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword],
    ...colour('keyword'),
  },
  { tag: [t.self, t.atom, t.bool, t.null], ...colour('keyword') },
  { tag: [t.string, t.special(t.string)], ...colour('string') },
  { tag: [t.regexp, t.escape], ...colour('regex') },
  { tag: t.number, ...colour('number') },
  { tag: [t.typeName, t.className, t.namespace, t.definition(t.typeName)], ...colour('type') },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName))],
    ...colour('func'),
  },
  {
    tag: [t.operator, t.arithmeticOperator, t.logicOperator, t.compareOperator, t.definitionOperator, t.updateOperator],
    ...colour('operator'),
  },
  { tag: [t.punctuation, t.separator, t.paren, t.squareBracket, t.brace, t.derefOperator], ...colour('punct') },
  { tag: [t.meta, decoratorName], ...colour('decorator') },
  { tag: [t.variableName, t.propertyName, t.definition(t.variableName)], ...colour('plain') },
])

// TypeScript as the playground's code is written, with the two names `highlight` colours apart
const typescript = new LanguageSupport(
  typescriptLanguage.configure({
    props: [
      styleTags({
        'Decorator/VariableName Decorator/CallExpression/VariableName': decoratorName,
        'MethodDeclaration/PropertyDefinition': t.function(t.definition(t.propertyName)),
      }),
    ],
  }),
)

// The frame, padding and fonts are prose.ts's, as for the playground's other fields; these are the parts it can't reach
const frame = EditorView.theme({
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--mc-ink-secondary)' },
  '.cm-cursor': { borderLeftColor: 'var(--mc-ink-primary)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--mc-accent-tint)' },
  '&.cm-focused': { outline: 'none' },
})

export interface Editor {
  /** Replaces the code, as picking an example or opening a share link does. */
  set(text: string): void
  destroy(): void
}

/**
 * Puts an editor in place of the playground's textarea, which stays the code's source of truth: the
 * editor starts from its value, writes every change back to it, and hides it.
 *
 * @param textarea - The playground's code field.
 * @param onRun - Called on Ctrl+Enter or ⌘+Enter, as in the textarea.
 * @returns The editor, to set its code or take it down.
 */
export function mountEditor(textarea: HTMLTextAreaElement, onRun: () => void): Editor {
  const view = new EditorView({
    doc: textarea.value,
    parent: textarea.parentElement ?? undefined,
    extensions: [
      lineNumbers(),
      history(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      typescript,
      syntaxHighlighting(highlightStyle),
      frame,
      keymap.of([
        { key: 'Mod-Enter', run: () => (onRun(), true) },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      // An explicit tab stop, so the scroller around it reads as reachable by keyboard
      EditorView.contentAttributes.of({
        'aria-label': 'Code',
        spellcheck: 'false',
        autocapitalize: 'off',
        tabindex: '0',
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) textarea.value = update.state.doc.toString()
      }),
    ],
  })
  view.dom.dataset.playgroundEditor = ''
  textarea.hidden = true
  return {
    set: text => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    destroy: () => {
      view.destroy()
      textarea.hidden = false
    },
  }
}
