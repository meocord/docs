import { ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { balances, TransferSlashController } from '@src/controllers/slash/transfer.slash.controller'

// #region spec
describe('TransferSlashController', () => {
  it('tells only the user what they are short of, as the bot would', async () => {
    const module = MeoCordTestingModule.create({ controllers: [TransferSlashController] }).compile()
    const interaction = createMockInteraction(ChatInputCommandInteraction, { commandName: 'transfer' })
    interaction.options = createChatInputOptions({ amount: 50 })
    balances.set(interaction.user.id, 20)

    // dispatch answers a UserError as the bot does, where invoke would reject with it
    await module.dispatch(interaction)

    const [answer] = getResponse(interaction).calls
    expect(JSON.stringify(answer?.payload)).toContain('You have 20 coins, 30 short of 50.')
    expect(Number((answer?.payload as { flags?: number }).flags) & MessageFlags.Ephemeral).toBeTruthy()
    expect(balances.get(interaction.user.id)).toBe(20)
  })
})
// #endregion spec
