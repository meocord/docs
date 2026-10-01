import { ChatInputCommandInteraction } from 'discord.js'
import { createMockInteraction, createMockMessage, createMockTheme } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { CardPresenter } from '@src/presenters/card.presenter'
import { CardRenderer } from '@src/presenters/card.renderer'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('CardPresenter', () => {
  const presenter = new CardPresenter(new CardRenderer())
  const theme = createMockTheme()
  const error = { message: 'Pick a smaller number.', error: new Error('x'), tone: 'warning' as const }

  it("draws an error as a PNG and shows it as the view's image", async () => {
    const context = {
      interaction: createMockInteraction(ChatInputCommandInteraction),
      locale: 'en-US',
      mode: 'embed' as const,
      theme,
    }
    const view = await presenter.error(context, error)

    expect(view).toMatchObject({ text: 'Pick a smaller number.', color: theme.colors.warning, image: 'error.png' })
    expect(view.files.map(file => file.name)).toEqual(['error.png'])
    expect([...view.files[0]!.data.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
  })

  it("draws a message command's error reply the same way", async () => {
    const context = { message: createMockMessage(), locale: 'en-US', mode: 'embed' as const, theme }
    const view = await presenter.messageError(context, error)

    expect(view).toMatchObject({ image: 'error.png', files: [{ name: 'error.png' }] })
  })
})
