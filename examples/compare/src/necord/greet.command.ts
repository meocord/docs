import { Injectable } from '@nestjs/common'
import { Context, Options, SlashCommand, type SlashCommandContext, StringOption } from 'necord'
import { GreetingService } from './greeting.service'

// #region command
// Options are declared on a class, and read with @Options()
class GreetOptions {
  @StringOption({ name: 'name', description: 'Who to greet', required: true })
  name: string
}

@Injectable()
export class GreetCommand {
  constructor(private readonly greetings: GreetingService) {}

  @SlashCommand({ name: 'greet', description: 'Greets someone' })
  async greet(@Context() [interaction]: SlashCommandContext, @Options() { name }: GreetOptions) {
    await interaction.reply({ content: this.greetings.build(name) })
  }
}
// #endregion command
