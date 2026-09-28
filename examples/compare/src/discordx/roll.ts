import { Discord, SimpleCommand, SimpleCommandMessage, SimpleCommandOption, SimpleCommandOptionType } from 'discordx'

// #region command
// A simple command declares each word as an option; the client's messageCreate listener passes messages on
@Discord()
export class Roll {
  @SimpleCommand({ name: 'roll', prefix: '!' })
  async roll(
    @SimpleCommandOption({ name: 'sides', type: SimpleCommandOptionType.Number }) sides: number | undefined,
    command: SimpleCommandMessage,
  ) {
    if (!sides || sides < 2) {
      await command.message.reply('Usage: !roll <sides>')
      return
    }
    await command.message.reply(String(1 + Math.floor(Math.random() * sides)))
  }
}
// #endregion command
