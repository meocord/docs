'use client'

import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Component, Div, For, Input, Span, type PortalLayerProps } from '@meonode/ui'
import { focusCss } from '@/lib/design/css'
import { Glyph } from '@/components/shell/icons'
import { useLayerFocus } from '@/components/shell/layer-focus'
import { PopoverSurface } from '@/components/shell/panes'
import { groupHits, jumps, lineOf, type Hit, type HitGroup, type PaletteEntry } from '@/lib/search-client'
import type { SearchLine } from '@/lib/search-manifest'

export interface PaletteData {
  lines: SearchLine[]
  /** What the reader typed while the palette was loading, taken once. */
  typed: () => string
  /** Called when the palette closes, so the next shortcut opens it again. */
  closed: () => void
}

interface PagefindResult {
  score: number
  data: () => Promise<{
    url: string
    excerpt: string
    meta: { title?: string }
    filters: { kind?: string[] }
    sub_results?: { url: string; title: string }[]
  }>
}

interface Pagefind {
  options: (options: { basePath: string }) => Promise<void>
  search: (query: string) => Promise<{ results: PagefindResult[] } | null>
}

// Each line's Pagefind bundle and palette index, loaded once per page view.
const engines = new Map<string, Promise<Pagefind>>()
const palettes = new Map<string, Promise<PaletteEntry[]>>()

function engine(line: SearchLine): Promise<Pagefind> {
  let loading = engines.get(line.search)
  if (!loading) {
    loading = import(/* webpackIgnore: true */ `${line.search}pagefind.js`).then(async (pagefind: Pagefind) => {
      await pagefind.options({ basePath: line.search })
      return pagefind
    })
    engines.set(line.search, loading)
  }
  return loading
}

function paletteIndex(line: SearchLine): Promise<PaletteEntry[]> {
  let loading = palettes.get(line.palette)
  if (!loading) {
    loading = fetch(line.palette).then(response => (response.ok ? response.json() : []))
    palettes.set(line.palette, loading)
  }
  return loading
}

/** Pagefind's excerpt without its markup, which the palette shows as text. */
const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

async function find(line: SearchLine, query: string): Promise<HitGroup[]> {
  const [pagefind, entries] = await Promise.all([engine(line), paletteIndex(line)])
  const search = await pagefind.search(query)
  const hits: Hit[] = await Promise.all(
    (search?.results ?? []).slice(0, 20).map(async result => {
      const data = await result.data()
      return {
        url: data.url,
        title: data.meta.title ?? data.url,
        kind: data.filters.kind?.[0] ?? 'guide',
        excerpt: plain(data.excerpt),
        sections: (data.sub_results ?? [])
          .filter(section => section.url !== data.url)
          .slice(0, 3)
          .map(section => ({ url: section.url, title: section.title })),
        score: result.score,
      }
    }),
  )
  return groupHits(query, hits, jumps(entries, query))
}

/** A row the arrow keys can reach: a result, or one of its sections under it. */
interface Option {
  id: string
  url: string
  title: string
  detail: string
  section: boolean
}

function optionsOf(groups: HitGroup[]): { group: HitGroup; options: Option[] }[] {
  let index = 0
  const id = () => `search-option-${index++}`
  return groups.map(group => ({
    group,
    options: group.hits.flatMap(hit => [
      { id: id(), url: hit.url, title: hit.title, detail: hit.excerpt, section: false },
      ...hit.sections.map(section => ({ id: id(), url: section.url, title: section.title, detail: '', section: true })),
    ]),
  }))
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

function Row(option: Option, active: boolean, choose: (option: Option) => void, hover: () => void) {
  return Div({
    id: option.id,
    role: 'option',
    'aria-selected': active,
    onClick: () => choose(option),
    onMouseMove: hover,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: option.section ? 30 : 40,
    padding: option.section ? '0 theme.space.3 0 theme.space.8' : '0 theme.space.3',
    borderRadius: 'theme.radius.row',
    cursor: 'pointer',
    backgroundColor: active ? 'theme.surface.fillHover' : 'transparent',
    children: [
      Span(option.section ? `# ${option.title}` : option.title, {
        key: 'title',
        // A section of a page reads as part of it: its size, in the secondary ink.
        fontSize: 'theme.type.control.size',
        fontWeight: option.section ? 'theme.font.weight.regular' : 'theme.font.weight.medium',
        color: option.section ? 'theme.ink.secondary' : 'theme.ink.primary',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }),
      option.detail
        ? Span(option.detail, {
            key: 'detail',
            fontSize: 'theme.type.caption.size',
            color: 'theme.ink.secondary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          })
        : null,
    ],
  })
}

/**
 * The command palette: a search field over the current line's guides, API and changelog, with jumps
 * to symbols and pages by name. Arrow keys move through the results, Enter opens one, Escape closes.
 * A search with nothing in the line offers the other lines.
 */
export const PaletteLayer = Component<PortalLayerProps<PaletteData>>(function PaletteLayer({ data, close }) {
  const router = useRouter()
  const layer = useRef<HTMLDivElement>(null)
  useLayerFocus(layer, close)
  const [scope, setScope] = useState<SearchLine | undefined>(() => lineOf(window.location.pathname, data.lines))
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<HitGroup[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [active, setActive] = useState(0)

  useEffect(() => data.closed, [data])
  // After the field has focus, which useLayerFocus gives it first: keys typed until then were buffered.
  useEffect(() => {
    const typed = data.typed()
    if (typed) setQuery(current => typed + current)
  }, [data])
  // Loaded as the palette opens, so the first query does not wait for the index.
  useEffect(() => {
    if (scope) void engine(scope).catch(() => setStatus('error'))
  }, [scope])

  useEffect(() => {
    const text = query.trim()
    if (!scope || !text) {
      setGroups([])
      setStatus('idle')
      return
    }
    let current = true
    setStatus('loading')
    const timer = setTimeout(() => {
      find(scope, text).then(
        found => {
          if (!current) return
          setGroups(found)
          setActive(0)
          setStatus('ready')
        },
        () => current && setStatus('error'),
      )
    }, 120)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query, scope])

  const listed = useMemo(() => optionsOf(groups), [groups])
  const options = useMemo(() => listed.flatMap(entry => entry.options), [listed])
  const others = data.lines.filter(line => line.line !== scope?.line)

  const choose = (option: Option) => {
    close()
    router.push(option.url)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (options.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(index => (index + step + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(options[Math.min(active, options.length - 1)])
    }
  }
  useEffect(() => {
    document.getElementById(options[active]?.id ?? '')?.scrollIntoView({ block: 'nearest' })
  }, [active, options])

  const empty = status === 'ready' && options.length === 0

  return Div({
    position: 'fixed',
    inset: 0,
    zIndex: 'theme.z.palette',
    backgroundColor: 'theme.surface.scrim',
    children: PopoverSurface({
      ref: layer,
      role: 'dialog',
      'aria-modal': true,
      'aria-label': 'Search the documentation',
      position: 'absolute',
      top: '12dvh',
      left: '50%',
      width: 'min(640px, calc(100vw - 2 * theme.space.4))',
      maxHeight: '70dvh',
      display: 'flex',
      flexDirection: 'column',
      padding: 0,
      overflow: 'hidden',
      css: {
        transform: 'translateX(-50%)',
        '@keyframes settle': { from: { opacity: 0, transform: 'translate(-50%, -4px) scale(.98)' } },
        animation: 'settle theme.motion.duration.open theme.motion.ease.enter',
        '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
      },
      children: [
        Div({
          key: 'field',
          display: 'flex',
          alignItems: 'center',
          gap: 'theme.space.2',
          padding: 'theme.space.3',
          borderBottom: 'theme.line.width solid theme.line.hairline',
          children: [
            Span(Glyph('search', 16), { key: 'icon', display: 'inline-flex', color: 'theme.ink.secondary' }),
            Input({
              key: 'input',
              type: 'search',
              role: 'combobox',
              'aria-expanded': options.length > 0,
              'aria-controls': 'search-results',
              'aria-activedescendant': options[active]?.id,
              'aria-autocomplete': 'list',
              'aria-label': scope ? `Search MeoCord ${scope.line}` : 'Search MeoCord',
              placeholder: scope ? `Search ${scope.line}` : 'Search',
              value: query,
              onChange: (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
              onKeyDown,
              flexGrow: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'theme.ink.primary',
              fontFamily: 'inherit',
              fontSize: 'theme.type.body.size',
              css: { '&::-webkit-search-cancel-button': { display: 'none' } },
            }),
            scope
              ? Span(scope.line, {
                  key: 'scope',
                  padding: '1px theme.space.2',
                  borderRadius: 'theme.radius.chip',
                  backgroundColor: 'theme.surface.fill',
                  fontSize: 'theme.type.caption.size',
                  color: 'theme.ink.secondary',
                  fontVariantNumeric: 'tabular-nums',
                })
              : null,
          ],
        }),
        Div({
          key: 'results',
          id: 'search-results',
          role: 'listbox',
          'aria-label': 'Search results',
          overflowY: 'auto',
          padding: options.length > 0 ? 'theme.space.2' : 0,
          children: For(
            listed,
            ({ group, options: rows }) =>
              Div({
                role: 'group',
                'aria-label': group.title,
                padding: 'theme.space.1 0',
                children: [
                  Div({
                    'aria-hidden': true,
                    children: group.title,
                    padding: 'theme.space.1 theme.space.3',
                    fontSize: 'theme.type.caption.size',
                    fontWeight: 'theme.font.weight.semibold',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'theme.ink.secondary',
                  }),
                  For(
                    rows,
                    option =>
                      Row(option, options[active]?.id === option.id, choose, () =>
                        setActive(options.findIndex(candidate => candidate.id === option.id)),
                      ),
                    option => option.id,
                  ),
                ],
              }),
            ({ group }) => group.kind,
          ),
        }),
        empty || status === 'error'
          ? Div({
              key: 'status',
              role: 'status',
              padding: 'theme.space.4 theme.space.3',
              fontSize: 'theme.type.control.size',
              color: 'theme.ink.secondary',
              children:
                status === 'error'
                  ? 'Search could not load. Check your connection and try again.'
                  : [
                      Span(`Nothing in ${scope?.line} for “${query.trim()}”.`, { key: 'none' }),
                      ...others.map(line =>
                        Button(`Search in ${line.line}?`, {
                          key: line.line,
                          type: 'button',
                          onClick: () => setScope(line),
                          marginLeft: 'theme.space.2',
                          padding: '0 theme.space.2',
                          height: 24,
                          border: 'none',
                          borderRadius: 'theme.radius.control',
                          backgroundColor: 'theme.surface.fill',
                          color: 'theme.ink.primary',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          cursor: 'pointer',
                          css: { ...focusCss, '&:hover': { backgroundColor: 'theme.surface.fillHover' } },
                        }),
                      ),
                    ],
            })
          : null,
        Div({
          key: 'keys',
          'aria-hidden': true,
          display: 'flex',
          gap: 'theme.space.4',
          padding: 'theme.space.2 theme.space.3',
          borderTop: 'theme.line.width solid theme.line.hairline',
          fontSize: 'theme.type.caption.size',
          color: 'theme.ink.secondary',
          children: [
            Span('↑↓ to move', { key: 'move' }),
            Span('↵ to open', { key: 'open' }),
            Span('esc to close', { key: 'close' }),
          ],
        }),
      ],
    }),
  }).render()
})
