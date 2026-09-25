import { createNode } from '@meonode/ui'
import { ClientLink } from '@/components/shell/client-link'

/**
 * Next's client-side link as a node factory. It wraps a component from a 'use client' module rather than
 * next/link itself: styled from a server component, next/link gets its class but not the class's rule,
 * while a client reference is styled on the client like any other node.
 */
export const Link = createNode(ClientLink)
