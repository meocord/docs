'use client'

import { useRef } from 'react'
import { Button, Component, Div, Fixed, Node, type PortalLayerProps, Row, usePortal } from '@meonode/ui'
import { focusCss, safe, touchCss, transitionCss } from '@/lib/design/css'
import { Glyph } from '@/components/shell/icons'
import { useLayerFocus } from '@/components/shell/layer-focus'
import { SidebarPane } from '@/components/shell/panes'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import { ThemeControl } from '@/components/shell/ThemeControl'
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

  return Fixed({
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
        // Rows a finger can take.
        '& nav a, & nav summary': { minHeight: 44 },
      },
      children: SidebarPane({
        width: '100%',
        position: 'relative',
        // Clear of a notch, a rounded corner or the home indicator.
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        children: [
          Row({
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `theme.space.3 theme.space.3 0 ${safe('theme.space.3', 'left')}`,
            children: [
              Node(ThemeControl, { key: 'theme', touch: true }),
              Button(Glyph('close'), {
                ...iconButton,
                key: 'close',
                type: 'button',
                'aria-label': 'Close navigation',
                onClick: close,
                css: { ...focusCss, ...touchCss },
              }),
            ],
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
    ...iconButton,
    type: 'button',
    'aria-label': 'Open navigation',
    'aria-haspopup': 'dialog',
    onClick: () => portal.open(NavSheet, { groups }),
    css: {
      ...transitionCss(),
      ...focusCss,
      ...touchCss,
      '&:hover': { color: 'theme.ink.primary', backgroundColor: 'theme.surface.fillHover' },
      '@media (width >= theme.breakpoint.compact)': { display: 'none' },
    },
  })
})
