import {
  type APIActionRowComponent,
  type APIComponentInMessageActionRow,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  User,
} from 'discord.js'
import { createMockInteraction, createMockMessage, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { CardButtonController } from '@src/controllers/button/card.button.controller'

// #region message
const card: APIActionRowComponent<APIComponentInMessageActionRow>[] = [
  {
    type: ComponentType.ActionRow,
    components: [
      { type: ComponentType.Button, style: ButtonStyle.Primary, custom_id: 'card/111/refresh', label: 'Refresh' },
      { type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: 'card/111/export', label: 'Export' },
    ],
  },
  {
    type: ComponentType.ActionRow,
    components: [
      { type: ComponentType.StringSelect, custom_id: 'card/111/sort', options: [{ label: 'Newest', value: 'new' }] },
    ],
  },
]

// A click on a message showing the card: createMockMessage takes its components as API JSON
const clickOnCard = (customId: string) =>
  createMockInteraction(ButtonInteraction, {
    customId,
    user: createMockInteraction(User, { id: '111' }),
    message: createMockMessage({ components: card }),
  })
// #endregion message

type Row = { components: { disabled?: boolean; emoji?: { name?: string } }[] }
const payloads = (interaction: ButtonInteraction) =>
  getResponse(interaction).calls.map(
    call => call.payload as { components?: Row[]; embeds?: { description?: string }[] },
  )

describe('@Defer on a message with controls', () => {
  const module = MeoCordTestingModule.create({ controllers: [CardButtonController] }).compile()

  // #region lock
  it('locks every control while the handler runs, then puts them back', async () => {
    const interaction = clickOnCard('card/111/refresh')

    await module.invoke(CardButtonController, 'refresh', interaction)

    expect(getResponse(interaction).calls.map(call => call.method)).toEqual(['deferUpdate', 'editReply', 'editReply'])
    const [, lock, answer] = payloads(interaction)
    // The lock: both buttons and the select disabled, the clicked button showing ⏳, the loading view added
    expect(lock.components!.flatMap(row => row.components.map(control => control.disabled))).toEqual([true, true, true])
    expect(lock.components![0].components[0].emoji).toEqual({ name: '⏳' })
    expect(lock.embeds!.at(-1)?.description).toBe('⏳ Working on it…')
    // The answer: send() without components restores them as they were, and drops the loading view
    expect(answer.components).toEqual(card)
    expect(answer.embeds!.some(embed => embed.description === '⏳ Working on it…')).toBe(false)
  })
  // #endregion lock

  // #region clicked
  it("with disable: 'clicked', locks only the button used", async () => {
    const interaction = clickOnCard('card/111/export')

    await module.invoke(CardButtonController, 'export', interaction)

    const [, lock] = payloads(interaction)
    expect(lock.components!.flatMap(row => row.components.map(control => control.disabled ?? false))).toEqual([
      false,
      true,
      false,
    ])
  })
  // #endregion clicked
})
