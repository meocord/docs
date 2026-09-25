import { createNode } from '@meonode/ui'
import { ClientLink } from '@/components/shell/client-link'

/**
 * Next's client-side link as a node factory, wrapping a component from a 'use client' module: next/link
 * itself gets its class but not the class's rule when styled from a server component (meonode#32).
 */
export const Link = createNode(ClientLink)
