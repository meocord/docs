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

/**
 * Narrows the sidebar's links to those whose title holds what is typed, keeping each match's group and
 * category, and says so when none does. Escape clears it. It only hides rows: the links, and which
 * one is the page read, stay as drawn.
 */
export const SidebarFilter = Component(function SidebarFilter() {
  const root = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [none, setNone] = useState(false)

  const apply = (value: string) => {
    setQuery(value)
    const nav = root.current?.closest('nav')
    if (!nav) return
    const needle = folded(value.trim())
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
    setNone(Boolean(needle) && shown === 0)
  }

  return Div({
    ref: root,
    'data-sidebar-filter': true,
    margin: '0 0 theme.space.2',
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
      P(none ? 'No pages match' : '', {
        key: 'none',
        role: 'status',
        margin: none ? 'theme.space.2 theme.space.2 0' : 0,
        fontSize: 'theme.type.small.size',
        color: 'theme.ink.secondary',
      }),
    ],
  })
})
