import { type ChatInputCommandInteraction, type HexColorString } from 'discord.js'
import { respond, ThemeCache } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { guildThemes } from '@src/themes/stored-themes'

// #region invalidate
@Controller()
export class ThemeSettingsSlashController {
  constructor(private readonly themes: ThemeCache) {}

  @Command('settings accent', CommandType.SLASH)
  async accent(interaction: ChatInputCommandInteraction) {
    // Checked when the theme is looked up: a bad colour is left out, with a warning, rather than failing the call
    const colour = interaction.options.getString('colour', true) as HexColorString
    guildThemes.set(interaction.guildId!, { colors: { primary: colour } })
    // The next call from this server looks its theme up again, rather than waiting for the cached one to expire
    this.themes.invalidateGuild(interaction.guildId!)
    await respond(interaction).send(`Accent set to ${colour}`)
  }
}
// #endregion invalidate
