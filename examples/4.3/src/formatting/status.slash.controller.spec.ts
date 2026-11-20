import { ChatInputCommandInteraction, PermissionsBitField } from 'discord.js'
import { DiscordLimits, splitMessage } from 'meocord/common'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it, vi } from 'vitest'
import { StatusSlashController } from '@src/formatting/status.slash.controller'
import { RULES } from '@src/formatting/rules'
import { SettingsSlashController } from '@src/controllers/slash/settings.slash.controller'

const command = (commandName: string, fields: Record<string, unknown> = {}) =>
  createMockInteraction(ChatInputCommandInteraction, { commandName, ...fields })
const sent = (interaction: ChatInputCommandInteraction) => getResponse(interaction).calls.map(call => call.payload)

describe('StatusSlashController', () => {
  // #region mention
  const module = MeoCordTestingModule.create({ controllers: [StatusSlashController, SettingsSlashController] })
    .overrideCommandId('settings', '1234567890123456789')
    .compile()

  it('points at the subcommand to run, as a clickable mention', async () => {
    const interaction = command('notify')
    await module.invoke(StatusSlashController, 'notify', interaction)
    expect(sent(interaction)[0]).toMatchObject({
      content: 'Turn email notifications on with </settings notify email:1234567890123456789>.',
    })
  })
  // #endregion mention

  it('writes the uptime for people', async () => {
    vi.spyOn(process, 'uptime').mockReturnValue(3_900)
    const interaction = command('uptime')
    await module.invoke(StatusSlashController, 'uptime', interaction)
    expect(sent(interaction)[0]).toMatchObject({ content: 'Up for 1 hour, 5 minutes.' })
  })

  it('names the permissions a member lacks as Discord does', async () => {
    const interaction = command('purge', { memberPermissions: new PermissionsBitField(['ReadMessageHistory']) })
    await expect(module.invoke(StatusSlashController, 'purge', interaction)).rejects.toThrow(
      'You need Manage Messages.',
    )
  })

  it('sends a long text in parts Discord takes', async () => {
    const interaction = command('rules')
    await module.invoke(StatusSlashController, 'rules', interaction)
    const parts = sent(interaction).map(payload => (payload as { content: string }).content)
    expect(parts).toEqual(splitMessage(RULES))
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every(part => part.length <= DiscordLimits.content)).toBe(true)
  })
})
