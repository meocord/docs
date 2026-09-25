// #region decorator
import { applyDecorators } from 'meocord/common'
import { Cooldown, UseGuard } from 'meocord/decorator'
import { ChannelGuard } from '@src/guards/channel.guard'

// A guard with its options and a cooldown, as one decorator
export const Protected = (channelId: string, seconds = 5) =>
  applyDecorators(UseGuard({ provide: ChannelGuard, params: { channelIds: [channelId] } }), Cooldown({ seconds }))
// #endregion decorator
