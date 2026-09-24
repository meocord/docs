'use client'

import type { ReactNode } from 'react'
import { PortalHost, PortalProvider, ThemeProvider } from '@meonode/ui'
import { themeModes } from '@/constants/themes/modes'
import { themeTokens } from '@/constants/themes/tokens'

/** The client providers at the root: portals, and the theme seeded from `data-theme`. */
export function Wrapper({ children }: { children: ReactNode }) {
  return PortalProvider({
    children: ThemeProvider({
      ...themeModes,
      tokens: themeTokens,
      children: [children, PortalHost({ key: 'portals' })],
    }),
  }).render()
}
