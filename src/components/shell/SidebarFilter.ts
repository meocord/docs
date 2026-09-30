'use client'

import { type ChangeEvent, type KeyboardEvent, useRef, useState } from 'react'
import { Component, Div, Input, P } from '@meonode/ui'
import { focusCss } from '@/lib/design/css'

/** A title as a reader types it: letter case and accents aside, so "resume" finds "Résumé". */
const folded = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** The element the sidebar's links scroll in: the pane's body, or the sheet's. */
function scrollerOf(element: Element): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement)
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node
  return null
}

/** Out of sight but read aloud: the status while it counts the pages shown. */
const countHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const

/**
 * Narrows the sidebar's links to those whose title holds what is typed, keeping each match's group and
 * category, and says how many pages show, or that none does. The matches show from the top, and
 * clearing the filter, as Escape does, puts the sidebar back where the reader left it. It only hides
 * rows: the links, and which one is the page read, stay as drawn.
 */
export const SidebarFilter = Component(function SidebarFilter() {
  const root = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  // How many pages the filter shows, or null while it is empty
  const [count, setCount] = useState<number | null>(null)
  // Where the sidebar was scrolled when filtering began, to go back to once it is cleared
  const left = useRef<number | null>(null)

  const apply = (value: string) => {
    setQuery(value)
    const nav = root.current?.closest('nav')
    if (!nav) return
    const needle = folded(value.trim())
    const scroller = scrollerOf(nav)
    // Read before any row hides, which clamps the offset to the shorter list
    if (needle && scroller) left.current ??= scroller.scrollTop
    let shown = 0
    for (const group of nav.querySelectorAll<HTMLDetailsElement>(':scope > [data-nav-group]')) {
      let matched = 0
      for (const row of group.querySelectorAll<HTMLLIElement>('li:has(> a)')) {
        const link = row.querySelector('a')!
        const title = link.querySelector('[title]')?.getAttribute('title') ?? link.textContent ?? ''
        row.hidden = Boolean(needle) && !folded(title).includes(needle)
        if (!row.hidden) matched += 1
      }
      // A category keeps its label only while one of its links shows
      for (const category of group.querySelectorAll<HTMLLIElement>('li:has(> [data-nav-category])'))
        category.hidden = !category.querySelector('li:has(> a):not([hidden])')
      group.hidden = matched === 0
      // A group closed by the reader opens while it holds a match, and closes again once cleared
      if (needle) {
        group.dataset.filterOpen ??= String(group.open)
        if (matched > 0) group.open = true
      } else if (group.dataset.filterOpen !== undefined) {
        group.open = group.dataset.filterOpen === 'true'
        delete group.dataset.filterOpen
      }
      shown += matched
    }
    setCount(needle ? shown : null)

    if (!scroller) return
    if (needle) scroller.scrollTop = 0
    else if (left.current !== null) {
      scroller.scrollTop = left.current
      left.current = null
    }
  }

  return Div({
    ref: root,
    'data-sidebar-filter': true,
    children: [
      Input({
        key: 'field',
        type: 'search',
        'aria-label': 'Filter pages',
        placeholder: 'Filter pages',
        autoComplete: 'off',
        spellCheck: false,
        value: query,
        onChange: (event: ChangeEvent<HTMLInputElement>) => apply(event.target.value),
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
          // Escape clears a filter, prevented so the sheet stays open; an empty one leaves it to the sheet
          if (event.key !== 'Escape' || !query) return
          event.preventDefault()
          apply('')
        },
        width: '100%',
        minHeight: 'theme.layout.row',
        padding: '0 theme.space.2',
        border: 'theme.line.width solid theme.line.strong',
        borderRadius: 'theme.radius.control',
        backgroundColor: 'theme.surface.canvas',
        color: 'theme.ink.primary',
        fontFamily: 'inherit',
        fontSize: 'theme.type.small.size',
        css: {
          ...focusCss,
          '&::-webkit-search-cancel-button': { display: 'none' },
          '@media (width < theme.breakpoint.compact)': { minHeight: 44 },
        },
      }),
      P(count === null ? '' : count === 0 ? 'No pages match' : count === 1 ? '1 page' : `${count} pages`, {
        key: 'count',
        role: 'status',
        margin: count === 0 ? 'theme.space.2 theme.space.2 0' : 0,
        // A count is for a screen reader: shown, it would deepen the pinned bar over the rows it keeps clear
        ...(count ? countHidden : {}),
        fontSize: 'theme.type.small.size',
        color: 'theme.ink.secondary',
      }),
    ],
  })
})
