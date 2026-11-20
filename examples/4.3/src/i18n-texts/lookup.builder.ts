import { SlashCommandBuilder, type SlashCommandSubcommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type CommandBuilderBase } from 'meocord/interface'
import { t } from '@src/i18n'

// #region params
// The kind is itself translated, so it is given as a function of the locale
function lookup(sub: SlashCommandSubcommandBuilder, thing: 'user' | 'role') {
  return sub
    .setName(thing)
    .setDescription(t.default('lookup.description', { thing: t.default(`lookup.things.${thing}`) }))
    .setDescriptionLocalizations(
      t.localizations('lookup.description', { thing: locale => t.locale(locale)(`lookup.things.${thing}`) }),
    )
}

@CommandBuilder(CommandType.SLASH)
export class LookupCommandBuilder implements CommandBuilderBase {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Look something up')
      .addSubcommand(sub => lookup(sub, 'user'))
      .addSubcommand(sub => lookup(sub, 'role'))
  }
}
// #endregion params
