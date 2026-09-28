// #region app
import { MeoCord } from 'meocord/decorator'
import { GatewayIntentBits } from 'discord.js'
import { t } from '@src/i18n'
import { color } from '@src/i18n-texts/color'
import { PaintController } from '@src/i18n-texts/paint.controller'

// The translator answers the app's replies and MeoCord's own texts alike
@MeoCord({
  controllers: [PaintController],
  clientOptions: {
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  },
  i18n: t,
  messages: { prefix: '!', types: { color } },
})
export default class TranslatedApp {}
// #endregion app
