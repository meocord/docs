import { type CanActivate, type ExecutionContext, Injectable, UseGuards } from '@nestjs/common'
import { type ButtonInteraction, MessageFlags } from 'discord.js'
import { Button, type ButtonContext, ComponentParam, Context, NecordExecutionContext } from 'necord'

// #region button
// A Nest guard reads the interaction out of Nest's execution context
@Injectable()
class OwnerGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const [interaction] = NecordExecutionContext.create(context).getContext<[ButtonInteraction]>()
    const [, ownerId] = interaction.customId.split('/')
    if (interaction.user.id === ownerId) return true
    await interaction.reply({ content: 'Only the user who opened this can use it.', flags: MessageFlags.Ephemeral })
    return false
  }
}

@Injectable()
export class CardComponent {
  @Button('card/:ownerId/refresh')
  @UseGuards(OwnerGuard)
  async refresh(@Context() [interaction]: ButtonContext, @ComponentParam('ownerId') ownerId: string) {
    await interaction.update({ content: `Refreshed for <@${ownerId}> at ${new Date().toISOString()}` })
  }
}
// #endregion button
