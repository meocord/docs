import { Command } from '@sapphire/framework'

// #region command
// A piece in the commands folder, found by the file loader when the client starts
export class GreetCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, description: 'Greets someone', cooldownLimit: 3, cooldownDelay: 10_000 })
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption(option => option.setName('name').setDescription('Who to greet').setRequired(true)),
    )
  }

  override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const name = interaction.options.getString('name', true)
    await interaction.reply({ content: this.container.greetings.build(name) })
  }
}
// #endregion command
