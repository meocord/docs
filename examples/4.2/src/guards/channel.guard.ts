// #region guard
import { type ChatInputCommandInteraction } from 'discord.js'
import { Guard, UseGuard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

@Guard()
export class ChannelGuard implements GuardInterface {
  // Set per use with @UseGuard({ provide: ChannelGuard, params: { channelIds } }), and checked against this
  declare readonly params?: { channelIds: string[] }

  canActivate(interaction: ChatInputCommandInteraction): boolean {
    const channelIds = this.params?.channelIds ?? []
    return channelIds.length === 0 || channelIds.includes(interaction.channelId)
  }
}

export const OnlyInChannels = (...channelIds: string[]) => UseGuard({ provide: ChannelGuard, params: { channelIds } })
// #endregion guard
