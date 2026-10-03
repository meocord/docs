import { createNode } from '@meonode/ui'

/** A credit in the footer: a link in the footer's colour, underlined. */
export const CreditLink = createNode('a', {
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: '0.18em',
  css: { '&:hover': { color: 'theme.ink.primary' } },
})
