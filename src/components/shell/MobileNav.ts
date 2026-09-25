'use client'

import { useRef } from 'react'
import { Button, Component, Div, usePortal, type PortalLayerProps } from '@meonode/ui'
import { focusCss, transitionCss } from '@/lib/design/css'
import { Glyph } from '@/components/shell/icons'
import { useLayerFocus } from '@/components/shell/layer-focus'
import { SidebarPane } from '@/components/shell/panes'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import type { NavGroup } from '@/components/shell/types'

const iconButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 'none',
  borderRadius: 'theme.radius.control',
  backgroundColor: 'transparent',
  color: 'theme.ink.secondary',
  cursor: 'pointer',
} as const

function NavSheet({ data, close }: PortalLayerProps<{ groups: NavGroup[] }>) {
  const ref = useRef<HTMLDivElement>(null)
  useLayerFocus(ref, close)

  return Div({
    position: 'fixed',
    inset: 0,
    zIndex: 'theme.z.sheet',
    backgroundColor: 'theme.surface.scrim',
    css: {
      '@keyframes fade': { from: { opacity: 0 } },
      animation: 'fade theme.motion.duration.open theme.motion.ease.enter',
    },
    children: Div({
      ref,
      role: 'dialog',
      'aria-modal': true,
      'aria-label': 'Documentation',
      height: '100%',
      width: 'min(theme.layout.sidebar + 40px, 85vw)',
      css: {
        '@keyframes slide': { from: { transform: 'translateX(-100%)' } },
        animation: 'slide theme.motion.duration.move theme.motion.ease.enter',
        '@media (prefers-reduced-motion: reduce)': { animationName: 'fade' },
      },
      children: SidebarPane({
        width: '100%',
        position: 'relative',
        children: [
          Div({
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 'theme.space.3 theme.space.3 0',
            children: Button(Glyph('close'), {
              type: 'button',
              'aria-label': 'Close navigation',
              onClick: close,
              ...iconButton,
              css: { ...focusCss },
            }),
          }),
          // A followed link replaces the page underneath, so the sheet closes with it.
          Div({
            onClick: (event: { target: EventTarget }) => (event.target as HTMLElement).closest('a') && close(),
            children: SidebarNav({ groups: data.groups }),
          }),
        ],
      }),
    }),
  }).render()
}

/** The menu button that replaces the sidebar below the compact breakpoint, opening it as a sheet. */
export const MobileNav = Component<{ groups: NavGroup[] }>(function MobileNav({ groups }) {
  const portal = usePortal()

  return Button(Glyph('sidebar'), {
    type: 'button',
    'aria-label': 'Open navigation',
    'aria-haspopup': 'dialog',
    onClick: () => portal.open(NavSheet, { groups }),
    ...iconButton,
    css: {
      ...transitionCss(),
      ...focusCss,
      '&:hover': { color: 'theme.ink.primary', backgroundColor: 'theme.surface.fillHover' },
      '@media (width >= theme.breakpoint.compact)': { display: 'none' },
    },
  })
})
