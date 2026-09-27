import { ChatInputCommandInteraction } from 'discord.js'
import { createMockInteraction, createMockTheme } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { BrandPresenter } from '@src/presenters/brand.presenter'

describe('BrandPresenter', () => {
  const presenter = new BrandPresenter()
  const theme = createMockTheme({ colors: { warning: '#B08400', danger: '#E3606D' } })
  const context = {
    interaction: createMockInteraction(ChatInputCommandInteraction),
    locale: 'en-US',
    mode: 'embed' as const,
    theme,
  }
  const error = new Error('x')

  it('titles a fault, in the danger colour', () => {
    expect(presenter.error(context, { message: 'Try again later.', error, tone: 'danger' })).toMatchObject({
      title: 'Something went wrong',
      text: 'Try again later.',
      color: '#E3606D',
    })
  })

  it("titles the user's own mistake apart, in the warning colour", () => {
    expect(presenter.error(context, { message: 'Pick a smaller number.', error, tone: 'warning' })).toMatchObject({
      title: 'Not quite',
      color: '#B08400',
    })
  })

  it("shows its loading text with the theme's loading emoji", () => {
    expect(presenter.loading(context)).toMatchObject({ text: 'Hang on…', emoji: theme.emojis.loading })
  })
})
