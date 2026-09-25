import type { Metadata } from 'next'
import { A, Column, H1, P } from '@meonode/ui'

export const metadata: Metadata = { alternates: { canonical: '/' } }

/** A placeholder until the landing page is designed. */
export default function HomePage() {
  return Column({
    as: 'main',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    textAlign: 'center',
    children: [
      H1('MeoCord', {
        margin: 0,
        fontSize: 'theme.type.h1.size',
        fontWeight: 600,
        letterSpacing: 'theme.type.h1.track',
      }),
      P('Decorator-based Discord bots on discord.js. The documentation is on its way.', {
        margin: 0,
        maxWidth: 520,
        color: 'theme.ink.secondary',
      }),
      A({
        href: 'https://github.com/meocord/meocord',
        color: 'theme.accent.default',
        children: 'Source on GitHub',
      }),
    ],
  }).render()
}
