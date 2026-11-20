import { ChatInputCommandInteraction } from 'discord.js'
import { createChatInputOptions, createMockInteraction, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it, vi } from 'vitest'
import { LookupSlashController } from '@src/controllers/slash/lookup.slash.controller'
import { ErrorReporter } from '@src/services/error-reporter.service'

const lookup = (id: string) => {
  const interaction = createMockInteraction(ChatInputCommandInteraction)
  interaction.options = createChatInputOptions({ id })
  return interaction
}

describe('LookupSlashController', () => {
  // #region spec
  const report = vi.fn()
  const module = MeoCordTestingModule.create({
    controllers: [LookupSlashController],
    providers: [{ provide: ErrorReporter, useValue: { report } }],
  }).compile()

  it('reports an error the handler throws, and lets it through', async () => {
    await expect(module.invoke(LookupSlashController, 'lookup', lookup('abc'))).rejects.toThrow('"abc" is not an id')
    expect(report).toHaveBeenCalledWith(expect.any(Error), 'LookupSlashController.lookup')
  })
  // #endregion spec

  it('reports nothing when the handler succeeds', async () => {
    report.mockClear()
    await expect(module.invoke(LookupSlashController, 'lookup', lookup('42'))).resolves.toEqual({ ran: true })
    expect(report).not.toHaveBeenCalled()
  })
})
