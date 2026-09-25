import { createHighlighterCoreSync, type ThemeRegistrationRaw } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import bash from 'shiki/langs/bash.mjs'
import diff from 'shiki/langs/diff.mjs'
import docker from 'shiki/langs/docker.mjs'
import dotenv from 'shiki/langs/dotenv.mjs'
import html from 'shiki/langs/html.mjs'
import javascript from 'shiki/langs/javascript.mjs'
import json from 'shiki/langs/json.mjs'
import jsonc from 'shiki/langs/jsonc.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import toml from 'shiki/langs/toml.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import { LANGUAGES } from '@/lib/prose/languages'

/**
 * Editor colours drawn from the site's palette, one hue per kind of token, each at 4.5:1 or better on
 * the code frame's canvas in its mode (checked in highlight.spec.ts).
 */
export const CODE_PALETTES = {
  dark: {
    background: '#161618',
    plain: '#E2E2E6',
    comment: '#8E8E98',
    keyword: '#8C98FF',
    decorator: '#F29CCB',
    string: '#6CCB91',
    regex: '#F07A72',
    number: '#F4A261',
    type: '#5FD3C6',
    func: '#EBD27A',
    operator: '#7FBFEA',
    punct: '#A8A8B2',
  },
  light: {
    background: '#F2F2F4',
    plain: '#26262A',
    comment: '#66666E',
    keyword: '#4150CC',
    decorator: '#A3317A',
    string: '#1F7A45',
    regex: '#B3322B',
    number: '#A1510B',
    type: '#0E7169',
    func: '#7A5A00',
    operator: '#1C6A99',
    punct: '#55555C',
  },
} as const

function theme(name: keyof typeof CODE_PALETTES): ThemeRegistrationRaw {
  const c = CODE_PALETTES[name]
  return {
    name: `meocord-${name}`,
    type: name,
    settings: [
      { settings: { foreground: c.plain, background: c.background } },
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: c.comment, fontStyle: 'italic' },
      },
      { scope: ['punctuation', 'meta.brace', 'punctuation.definition.tag'], settings: { foreground: c.punct } },
      {
        scope: [
          'keyword.operator',
          'keyword.operator.assignment',
          'keyword.operator.arithmetic',
          'keyword.operator.logical',
          'storage.type.function.arrow',
          'keyword.operator.type.annotation',
        ],
        settings: { foreground: c.operator },
      },
      {
        scope: [
          'keyword',
          'storage',
          'storage.type',
          'storage.modifier',
          'keyword.operator.new',
          'keyword.operator.expression',
          'constant.language',
          'variable.language',
          'entity.name.tag',
        ],
        settings: { foreground: c.keyword },
      },
      {
        scope: ['string', 'string.template', 'punctuation.definition.string', 'markup.inline.raw'],
        settings: { foreground: c.string },
      },
      {
        scope: ['string.regexp', 'constant.other.character-class.regexp', 'constant.character.escape'],
        settings: { foreground: c.regex },
      },
      {
        scope: ['constant.numeric', 'constant.other.caps', 'variable.other.env', 'support.constant'],
        settings: { foreground: c.number },
      },
      {
        scope: [
          'entity.name.type',
          'entity.name.class',
          'support.type',
          'support.class',
          'entity.other.inherited-class',
          'entity.name.type.module',
        ],
        settings: { foreground: c.type },
      },
      {
        scope: ['entity.name.function', 'support.function', 'entity.other.attribute-name', 'markup.heading'],
        settings: { foreground: c.func },
      },
      { scope: ['markup.inserted'], settings: { foreground: c.string } },
      { scope: ['markup.deleted'], settings: { foreground: c.regex } },
      { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
      // Last, so a decorator's name and its @ win over the function colour; its arguments keep theirs.
      {
        scope: [
          'punctuation.decorator',
          'meta.decorator entity.name.function',
          'meta.decorator variable.other.readwrite',
        ],
        settings: { foreground: c.decorator },
      },
    ],
  }
}

let highlighter: ReturnType<typeof createHighlighterCoreSync> | undefined

// Built on first use, synchronously: the JavaScript regex engine needs no WebAssembly.
function instance() {
  highlighter ??= createHighlighterCoreSync({
    themes: [theme('dark'), theme('light')],
    langs: [typescript, tsx, javascript, json, jsonc, bash, dotenv, yaml, toml, docker, markdown, html, diff],
    engine: createJavaScriptRegexEngine(),
  })
  return highlighter
}

/**
 * The code as highlighted HTML for the inside of a `<code>`: one span per token, each carrying both
 * themes' colours as `--code-dark` and `--code-light`, which globals.css picks between by
 * `data-theme`. Undefined for plain text and for a language it does not draw.
 */
export function highlight(code: string, language: string | undefined): string | undefined {
  const lang = language && LANGUAGES[language.toLowerCase()]
  if (!lang) return undefined
  const html = instance().codeToHtml(code, {
    lang,
    themes: { dark: 'meocord-dark', light: 'meocord-light' },
    defaultColor: false,
    cssVariablePrefix: '--code-',
  })
  const inner = /<code>([\s\S]*)<\/code>/.exec(html)
  return inner?.[1]
}
