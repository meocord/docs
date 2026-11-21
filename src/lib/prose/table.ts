import { Div, type NodeInstance } from '@meonode/ui'

/** What names a table's frame for a screen reader: the heading it sits under, by its id, or a text when it has none. */
export type TableName = { heading: string } | { text: string }

/**
 * A table in the frame that scrolls it sideways when it is wider than the column. The frame takes focus, so a
 * keyboard reader can reach it and scroll it with the arrow keys, and is a region named by `name`, so a screen
 * reader says what the focus stopped on. Whether a table overflows depends on the reader's width, and pages are the
 * same for every reader, so every frame takes focus, as code blocks do.
 */
export function tableFrame(key: string | number, name: TableName, table: NodeInstance, params = false) {
  // Named values, since @meonode/compiler leaves a call with an inline expression for a value uncompiled
  const marked = params || undefined
  const labelledBy = 'heading' in name ? name.heading : undefined
  const label = 'text' in name ? name.text : undefined
  return Div({
    key,
    'data-table': true,
    'data-params': marked,
    role: 'region',
    'aria-labelledby': labelledBy,
    'aria-label': label,
    tabIndex: 0,
    children: table,
  })
}
