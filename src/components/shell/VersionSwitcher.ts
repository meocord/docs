'use client'

import { type KeyboardEvent, type MouseEvent, useRef } from 'react'
import { Button, Component, Div, For, Span, usePortal, type PortalLayerProps } from '@meonode/ui'
import { focusCss, transitionCss } from '@/lib/design/css'
import { Glyph } from '@/components/shell/icons'
import { moveMenuFocus, useLayerFocus } from '@/components/shell/layer-focus'
import { Link } from '@/components/shell/links'
import { PopoverSurface } from '@/components/shell/panes'
import type { VersionOption, VersionStatus } from '@/components/shell/types'

const GROUPS: { status: VersionStatus; title: string }[] = [
  { status: 'latest', title: 'Latest' },
  { status: 'maintained', title: 'Maintained' },
  { status: 'prerelease', title: 'Prerelease' },
  { status: 'archived', title: 'Archived' },
]

const DOT: Record<VersionStatus, string> = {
  latest: 'theme.callout.tip.glyph',
  maintained: 'theme.ink.secondary',
  prerelease: 'theme.callout.warning.glyph',
  archived: 'theme.ink.quiet',
}

export interface VersionSwitcherProps {
  current: VersionOption
  options: VersionOption[]
}

interface MenuData extends VersionSwitcherProps {
  /** Where the trigger sits, so the menu opens under its right edge. */
  anchor: { bottom: number; right: number }
}

function VersionRow(option: VersionOption, current: VersionOption, close: () => void) {
  const selected = option.href === current.href
  return Link({
    href: option.href,
    role: 'menuitem',
    tabIndex: -1,
    'aria-current': selected ? 'page' : undefined,
    onClick: close,
    display: 'flex',
    alignItems: 'center',
    gap: 'theme.space.2',
    minHeight: 32,
    padding: '0 theme.space.2',
    borderRadius: 'theme.radius.control',
    fontSize: 'theme.type.control.size',
    textDecoration: 'none',
    color: 'theme.ink.primary',
    css: { ...focusCss, '&:hover, &:focus-visible': { backgroundColor: 'theme.surface.fillHover' } },
    children: [
      Span(null, { width: 6, height: 6, borderRadius: '50%', backgroundColor: DOT[option.status] }),
      Span(option.label, { flexGrow: 1, fontVariantNumeric: 'tabular-nums' }),
      option.date ? Span(option.date, { color: 'theme.ink.secondary', fontVariantNumeric: 'tabular-nums' }) : null,
      Span(Glyph('check'), { width: 16, color: 'theme.accent.default', visibility: selected ? 'visible' : 'hidden' }),
    ],
  })
}

function VersionMenu({ data, close }: PortalLayerProps<MenuData>) {
  const ref = useRef<HTMLDivElement>(null)
  useLayerFocus(ref, close)
  const groups = GROUPS.map(group => ({
    ...group,
    options: data.options.filter(o => o.status === group.status),
  })).filter(group => group.options.length > 0)

  return PopoverSurface({
    ref,
    role: 'menu',
    'aria-label': 'Documentation version',
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => ref.current && moveMenuFocus(event, ref.current),
    position: 'fixed',
    top: data.anchor.bottom + 6,
    right: data.anchor.right,
    zIndex: 'theme.z.popover',
    width: 248,
    maxHeight: 'min(420px, 70dvh)',
    overflowY: 'auto',
    css: {
      '@keyframes settle': { from: { opacity: 0, transform: 'translateY(-4px) scale(.98)' } },
      animation: 'settle theme.motion.duration.open theme.motion.ease.enter',
      transformOrigin: 'top right',
      '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
    },
    children: For(
      groups,
      group =>
        Div({
          role: 'group',
          'aria-label': group.title,
          padding: 'theme.space.1 0',
          children: [
            Div({
              'aria-hidden': true,
              children: group.title,
              padding: 'theme.space.1 theme.space.2',
              fontSize: 'theme.type.caption.size',
              fontWeight: 'theme.font.weight.semibold',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'theme.ink.secondary',
            }),
            For(
              group.options,
              option => VersionRow(option, data.current, close),
              option => option.href,
            ),
          ],
        }),
      group => group.status,
    ),
  }).render()
}

/** The toolbar's version control: shows the line being read and opens a menu of the others. */
export const VersionSwitcher = Component<VersionSwitcherProps>(function VersionSwitcher({ current, options }) {
  const portal = usePortal()

  return Button(
    [
      Span(current.label),
      current.status === 'prerelease'
        ? Span(null, { width: 6, height: 6, borderRadius: '50%', backgroundColor: DOT.prerelease })
        : null,
      Span(Glyph('chevronDown'), { color: 'theme.ink.secondary', display: 'inline-flex' }),
    ],
    {
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-label': `Documentation version ${current.label}`,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        portal.open(VersionMenu, {
          current,
          options,
          anchor: { bottom: rect.bottom, right: window.innerWidth - rect.right },
        })
      },
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'theme.space.1',
      height: 28,
      padding: '0 theme.space.2',
      border: 'none',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'transparent',
      color: 'theme.ink.primary',
      fontFamily: 'inherit',
      fontSize: 'theme.type.control.size',
      fontVariantNumeric: 'tabular-nums',
      cursor: 'pointer',
      css: { ...transitionCss(), ...focusCss, '&:hover': { backgroundColor: 'theme.surface.fillHover' } },
    },
  )
})
