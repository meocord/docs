// #region guard
import { type ChatInputCommandInteraction } from 'discord.js'
import { Guard, UseGuard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

@Guard()
export class ChannelGuard implements GuardInterface {
  // Set per use: @UseGuard({ provide: ChannelGuard, params: { channelIds } })
  channelIds: string[] = []

  canActivate(interaction: ChatInputCommandInteraction): boolean {
    return this.channelIds.length === 0 || this.channelIds.includes(interaction.channelId)
  }
}

export const OnlyInChannels = (...channelIds: string[]) => UseGuard({ provide: ChannelGuard, params: { channelIds } })
// #endregion guard
