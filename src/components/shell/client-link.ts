'use client'

import NextLink from 'next/link'
import { type ComponentProps, createElement } from 'react'

/** Next's link, behind this module's client boundary. */
export function ClientLink(props: ComponentProps<typeof NextLink>) {
  return createElement(NextLink, props)
}
