import {
  type ChatInputCommandInteraction,
  GatewayIntentBits,
  type GuildMember,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js'
import { createTranslator, defineCatalog, respond } from 'meocord/common'
import { Command, CommandBuilder, Controller, Cooldown, MeoCord, On } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region catalog
// The default catalog is typed; every other one only has to cover what it translates
const enUS = defineCatalog({
  announce: {
    name: 'announce',
    description: 'Post an announcement',
    message: 'The announcement',
    heading: '📣 Announcement',
    posted: 'Posted. Everyone sees it in the server’s language.',
  },
  welcome: 'Welcome to {server}, {user}!',
})

const id = {
  announce: {
    name: 'umumkan',
    description: 'Kirim pengumuman',
    message: 'Isi pengumuman',
    heading: '📣 Pengumuman',
    posted: 'Terkirim. Semua orang melihatnya dalam bahasa server.',
  },
  welcome: 'Selamat datang di {server}, {user}!',
  // #endregion catalog
  // #region catalog-meocord
  // MeoCord's own texts, all of them; one left out would stay in MeoCord's English
  meocord: {
    usage: {
      heading: 'Cara pakai: {usage}',
      headingMany: 'Cara pakai:\n{usages}',
      missing: '{param} belum diisi',
      notValid: '{label}: "{word}" bukan {type} yang sah',
      notOneOf: '{label}: "{word}" bukan salah satu dari {choices}',
      notMember: '{label}: <@{id}> bukan anggota server ini',
      noUser: '{label}: tidak ada pengguna dengan ID {id}',
      notRole: '{label}: <@&{id}> bukan peran di server ini',
      notChannel: '{label}: "{word}" bukan saluran',
      unknownFlag: '--{flag} bukan opsi perintah ini',
      notYesNo: '{label}: "{value}" bukan ya atau tidak',
      flagNeedsValue: '{label} perlu nilai, seperti {label}=<{flag}>',
      tooManyWords: 'Perintah ini menerima lebih sedikit kata',
      serverOnly: 'Perintah ini hanya bisa dipakai di server.',
      dmOnly: 'Perintah ini hanya bisa dipakai di pesan langsung.',
    },
    types: {
      string: 'teks',
      int: 'bilangan bulat',
      number: 'angka',
      bool: 'jawaban ya atau tidak',
      duration: 'lama waktu, seperti 10m',
      member: 'anggota',
      user: 'pengguna',
      role: 'peran',
      channel: 'saluran',
    },
    cooldown: {
      // {when} is a Discord timestamp, which Discord words in the reader's language: "dalam 45 detik"
      until: 'Pelan-pelan: coba lagi {when}.',
      storeDown: 'Cooldown tidak bisa diperiksa sekarang: coba lagi sebentar lagi.',
    },
    fallback: {
      notFound: 'Perintah tidak ditemukan!',
      error: 'Terjadi kesalahan saat menjalankan perintah.',
    },
    dm: {
      error: '{command} di {channel} pada {server}: {reason}',
      cooldown: '{command} di {channel} pada {server}: {wait}',
    },
    presenter: {
      loading: 'Sedang diproses…',
      errorTitle: 'Ups!',
    },
    help: {
      commandsHeading: 'Perintah:',
      commandsHint: 'Ketik {invocation} <perintah> untuk cara pakai satu perintah.',
      describedCommand: '{usage} — {description}',
      param: '{name}: {label}',
      optionalParam: '{name} (opsional): {label}',
      params: '{params}',
      aliases: 'Juga: {aliases}',
      serverOnly: 'Hanya bisa dipakai di server.',
      dmOnly: 'Hanya bisa dipakai di pesan langsung.',
      unknown: 'Tidak ada perintah bernama "{query}". Ketik {invocation} untuk melihat daftarnya.',
      emptyHere: 'Tidak ada perintah yang bisa kamu pakai di sini.',
      emptyServerOnly: 'Perintah-perintah ini hanya bisa dipakai di server.',
      listOf: '{label}, satu atau lebih',
      flagOn: 'aktif bila diberikan',
      oneOf: 'salah satu dari {choices}',
    },
  },
  // #endregion catalog-meocord
  // #region catalog
}
// #endregion catalog

// #region translator
// At module scope: the builder runs when its class is decorated
export const t = createTranslator({ default: 'en-US', locales: { 'en-US': enUS, id } })
// #endregion translator

// #region builder
// Discord shows the command's name and description in each member's language
@CommandBuilder(CommandType.SLASH)
export class AnnounceCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setNameLocalizations(t.localizations('announce.name'))
      .setDescription(t.default('announce.description'))
      .setDescriptionLocalizations(t.localizations('announce.description'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
      .addStringOption(option =>
        option
          .setName('message')
          .setDescription(t.default('announce.message'))
          .setDescriptionLocalizations(t.localizations('announce.message'))
          .setRequired(true),
      )
  }
}
// #endregion builder

// #region controller
@Controller()
export class AnnounceController {
  // Interactions report the default name, so the route is `announce` in every language
  @Command('announce', AnnounceCommandBuilder)
  // One announcement a minute in each server; MeoCord answers a second one in the author's language
  @Cooldown({ uses: 1, seconds: 60, per: 'guild' })
  async announce(interaction: ChatInputCommandInteraction, { message }: { message: string }) {
    // What everyone sees, in the server's language
    const everyone = t.for(interaction, { public: true })
    await respond(interaction).send({ content: `**${everyone('announce.heading')}**\n${message}` })
    // What only the author sees, in their own
    await respond(interaction).followUp({
      content: t.for(interaction)('announce.posted'),
      flags: MessageFlags.Ephemeral,
    })
  }

  // An event has no user locale: greet in the server's
  @On('guildMemberAdd')
  async welcome(member: GuildMember) {
    const text = t.forGuild(member.guild)('welcome', { server: member.guild.name, user: member.toString() })
    await member.guild.systemChannel?.send({ content: text })
  }
}
// #endregion controller

// #region app
// The translator answers MeoCord's own texts too: cooldowns, usage, errors and "Command not found!"
@MeoCord({
  controllers: [AnnounceController],
  i18n: t,
  clientOptions: { intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] },
})
export default class AnnounceApp {}
// #endregion app
