import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/app/globals.css'
import { Body, Head, Html, Node, themeScript } from '@meonode/ui'
import { StyleRegistry } from '@meonode/ui/nextjs-registry'
import { Wrapper } from '@/components/Wrapper'
import { themeModes } from '@/constants/themes/modes'
import { SITE_INDEXABLE, SITE_URL } from '@/config/site'
import { ogImage } from '@/lib/og/cards'
import { mono, sans } from '@/app/fonts'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#161618' },
    { media: '(prefers-color-scheme: light)', color: '#f2f2f4' },
  ],
}

const description = 'Documentation for MeoCord, the decorator-based Discord bot framework built on discord.js.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'MeoCord', template: '%s · MeoCord' },
  description,
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    siteName: 'MeoCord',
    type: 'website',
    locale: 'en_US',
    description,
    images: [ogImage('site', 'home')],
  },
  twitter: { card: 'summary_large_image' },
  robots: SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return Html({
    lang: 'en',
    className: `${sans.variable} ${mono.variable}`,
    // The mode is stamped as `data-theme` before paint, so the server's markup never depends on the reader.
    suppressHydrationWarning: true,
    children: [
      // First in <head>: an inline script after a stylesheet waits for that sheet to load.
      Head({ key: 'head', children: themeScript(themeModes) }),
      Body({
        key: 'body',
        children: StyleRegistry({ children: Node(Wrapper, { children }) }),
      }),
    ],
  }).render()
}
