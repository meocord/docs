import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Defer } from 'meocord/decorator'
import { NoteCommandBuilder, NotesCommandBuilder } from '@src/recipes/database/notes.builders'
import { NotesStore } from '@src/recipes/database/notes.store'

// #region controller
@Controller()
export class NotesController {
  constructor(private readonly notes: NotesStore) {}

  // A query can outlast Discord's three seconds, so @Defer acknowledges first
  @Command('note', NoteCommandBuilder)
  @Defer({ ephemeral: true })
  async add(interaction: ChatInputCommandInteraction, { text }: { text: string }) {
    await this.notes.add(interaction.user.id, text)
    await respond(interaction).send({ content: 'Saved.' })
  }

  @Command('notes', NotesCommandBuilder)
  @Defer({ ephemeral: true })
  async list(interaction: ChatInputCommandInteraction) {
    const notes = await this.notes.list(interaction.user.id)
    const content = notes.length ? notes.map(note => `${note.id}. ${note.text}`).join('\n') : 'No notes yet.'
    await respond(interaction).send({ content })
  }
}
// #endregion controller
