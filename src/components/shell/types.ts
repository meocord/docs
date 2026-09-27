import type { GlyphName } from '@/components/shell/icons'

/** One link in the sidebar. Every `href` the shell receives is final: callers resolve stored links first. */
export interface NavItem {
  title: string
  href: string
  /** The page being read. */
  current?: boolean
  /** A short chip after the title, such as "New". */
  badge?: string
  /** The sub-group it belongs to within its group, such as a kind's category; a heading marks where one starts. */
  category?: string
}

/** One of the sidebar's top-level tabs, such as the Guide or the API; the current one is marked. */
export interface NavTab {
  title: string
  href: string
  current?: boolean
}

/** A titled group of sidebar links. */
export interface NavGroup {
  title: string
  items: NavItem[]
  /** The glyph beside the group's title. */
  icon?: GlyphName
}

/** One step of the breadcrumb trail; the last is the current page and carries no link. */
export interface Crumb {
  title: string
  href?: string
}

export type VersionStatus = 'latest' | 'maintained' | 'prerelease' | 'archived'

/** A docs line the switcher can go to. */
export interface VersionOption {
  /** What the switcher shows, such as `4.1`. */
  label: string
  href: string
  status: VersionStatus
  /** The line's release date, shown beside it. */
  date?: string
}

/** A heading in the "On this page" list. */
export interface TocEntry {
  id: string
  title: string
  depth: 2 | 3
}
