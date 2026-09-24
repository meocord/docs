---
id: configuration
title: "Configuration"
order: 5
source: readme@4.1.0-beta.0
---

### `meocord.config.ts`

The top-level config file. At minimum it needs `discordToken`. The `rsbuild` hook lets you adjust the build without ejecting.

```typescript
import 'dotenv/config'
import { type MeoCordConfig } from 'meocord/interface'

export default {
  appName: 'MyBot',
  discordToken: process.env.DISCORD_TOKEN!,
  rsbuild: config => {
    // Import .md and .html files as their text.
    config.tools ??= {}
    config.tools.rspack = (_rspackConfig, { addRules }) => {
      addRules([{ test: /\.(md|html)$/i, type: 'asset/source' }])
    }
    return config
  },
} satisfies MeoCordConfig
```

MeoCord builds with [Rsbuild](https://rsbuild.rs). The hook receives its configuration and returns it, modified. A few things it handles for you, so you do not need rules for them:

- **Images, fonts, svg and media** are emitted to `dist/assets/`, and importing one gives you its absolute path on disk — ready for `fs`, canvas, or a Discord attachment. Nothing is ever inlined as a data URI, whatever its size.
- **Custom asset paths** — `output.filename.image` (and `svg`, `font`, `media`) accept a function, for when two files share a name in different folders:

  ```typescript
  import path from 'node:path'

  // ...
  rsbuild: config => {
    config.output ??= {}
    config.output.filename = {
      ...config.output.filename,
      // Keep the folder a file came from, so image/star.webp and image/hsr/star.webp do not collide.
      // The result is relative to dist/assets/, and uses / on every platform.
      image: ({ filename }) => path.relative('src/assets', filename ?? '').split(path.sep).join('/'),
    }
    return config
  },
  ```

- **Raw bundler rules** go through `tools.rspack`, which takes a webpack-shaped configuration.

| Option               | Default | Description                                                                                                |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `discordToken`       | —       | The bot token. Read it from the environment rather than writing it here.                                   |
| `appName`            | —       | Shown in log lines.                                                                                        |
| `rsbuild`            | —       | `(config) => config` — adjust the Rsbuild configuration.                                                   |
| `bundleDependencies` | `false` | Put everything the bot needs inside `dist`, native addons included, so it runs without `node_modules`.     |
| `externals`          | `[]`    | Modules to keep out of the bundle. Native addons are found without being listed.                           |
| `optionalExternals`  | `[]`    | Packages a dependency tries to load and runs without, such as `supports-color`; see below.                 |
| `shutdownTimeout`    | `10000` | Milliseconds shutdown waits for the [`onShutdown` hooks](/docs/4.1/lifecycle-hooks#lifecycle-hooks), all of them together.          |
| `commands`           | global  | Where commands are registered, and whether at startup — see [Command registration](#command-registration). |
| `sharding`           | —       | Split the gateway connection into shards — see [Sharding](/docs/4.1/deployment#sharding).                                      |

See [Self-contained builds](/docs/4.1/deployment#self-contained-builds) for when to turn on `bundleDependencies`.

Some dependencies try to load a package and carry on without it: `debug`, which axios and the HTTP proxy agents bring in, probes for `supports-color` inside a `try`. With `bundleDependencies` on, each such package warns at every build. List it in `optionalExternals`: it stays a `require` where the dependency calls it, so a missing package is caught by the dependency, and it is copied into `dist/node_modules` when it is installed. Do not put it in `externals` as well, where it becomes an import that runs before the bot and fails when the package is missing; MeoCord warns if you do.

```typescript
optionalExternals: ['supports-color'],
```

### Environment variables

Load `.env` in `meocord.config.ts`, as the generated one does with `import 'dotenv/config'`, not in `main.ts`. The build runs the config ahead of `main.ts`, so every `process.env` value it loads is already set when `@MeoCord({...})` and the rest of your modules read it — whether the bot starts with `meocord start`, `node dist/main.js`, bun, pm2 or Docker.

To keep one file per environment, put the choice in a module the config imports:

```typescript
// src/load-env.ts
import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'

// APP_ENV picks the file: .env.dev, .env.staging, .env.prod. Paths resolve from the directory the bot starts in.
const file = path.resolve(`.env.${process.env.APP_ENV ?? 'dev'}`)

config({ path: existsSync(file) ? file : path.resolve('.env'), quiet: true })
```

```typescript
// meocord.config.ts
import './src/load-env'
import { type MeoCordConfig } from 'meocord/interface'

export default {
  discordToken: process.env.DISCORD_TOKEN!,
} satisfies MeoCordConfig
```

```shell
APP_ENV=staging node dist/main.js
```

Start the bot from the project root: the `.env` files and `dist/meocord.config.mjs` are both found from the working directory, so set `cwd` in pm2 and `WORKDIR` in a Dockerfile.

### Command registration

The bot registers its slash, context menu and entry point commands once it is ready. By default they go globally, every start. `commands` in `meocord.config.ts` changes where:

```typescript
export default {
  discordToken: process.env.DISCORD_TOKEN!,
  commands: {
    developmentGuild: process.env.DEV_GUILD_ID || undefined, // every command goes here under start --dev
    guilds: undefined, // guild ids to register to instead of globally
    register: true, // false: only `meocord register` registers
    clearOther: false, // true: remove this app's commands from the scopes above that are not in use
  },
} satisfies MeoCordConfig
```

| Option             | Default | Description                                                                                                                                                                        |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guilds`           | —       | Register every command to these guilds instead of globally. Unset or empty: global.                                                                                                |
| `developmentGuild` | —       | While `NODE_ENV` is `development`, as under `start --dev`, every command goes to this guild and nowhere else. Guild commands show at once.                                         |
| `register`         | `true`  | Register at startup. Set `false` to register only with `meocord register`, from CI for instance.                                                                                   |
| `clearOther`       | `false` | Remove this application's commands from the scopes named here but not in use. Without it, or while `developmentGuild` receives every command, leftovers are reported as a warning. |

Each scope gets one bulk update, which replaces everything the application has there, so a removed command disappears on the next registration. A failed registration is logged and the bot stays online.

**One command in its own guilds.** A builder's `guilds` option sends its command to those guilds only, in place of the scope above — for staff commands, say. The ids are read when the class is decorated, after `.env` has loaded:

```typescript
@CommandBuilder(CommandType.SLASH, { guilds: [process.env.STAFF_GUILD_ID] })
export class BanCommandBuilder implements CommandBuilderBase {
  build(commandName: string) {
    return new SlashCommandBuilder().setName(commandName).setDescription('Ban a member')
  }
}
```

A builder whose list is empty after dropping blank ids is not registered anywhere, rather than published globally by accident. Under a development guild it goes there with the rest.

**Leftovers.** Moving from global to guild commands, or the other way, leaves the old ones behind, and Discord shows both. After registering, MeoCord checks the scopes this configuration names — global, `guilds`, `developmentGuild` and builders' guilds — that it did not send to, and warns about any commands left there; `clearOther: true` removes them instead. While `developmentGuild` receives every command, as under `start --dev`, leftovers are only warned about, even with `clearOther`: development and production often share one application, and the global commands belong to production. Production starts and `meocord register` without `--dev` remove them.

**Unchanged commands in development.** Under `start --dev`, a scope whose commands have not changed since the last start from this project is not sent again. The record lives in `node_modules/.cache/meocord`, per application and scope. `meocord start --dev --force-register` sends them anyway — after deleting commands in the developer portal, for instance. Production always sends; the update is idempotent.

**Registering without starting.** `meocord register` registers and exits, without logging in to the gateway. It runs the built bot in a register-only mode that reads the commands and constructs no controller or service, so it needs a build (`--build` makes one) and the same token as the bot:

```shell
npx meocord register --build          # production scope
npx meocord register --dev            # to commands.developmentGuild
npx meocord register --guild 1234567  # every command to one guild
```

It exits non-zero when Discord rejects the token or the commands, so a deploy step can stop on it.

### ESLint

MeoCord exports a base ESLint config from `meocord/eslint`. It lints your TypeScript, `meocord.config.ts`
included, with type information from `tsconfig.json`, `tsconfig.test.json` and `tsconfig.eslint.json`; a
file ESLint reports as not included in any of them needs listing in one. Extend it as needed:

```javascript
import meocordEslint, { typescriptConfig } from 'meocord/eslint'
import unusedImports from 'eslint-plugin-unused-imports'

export default [
  ...meocordEslint,
  {
    ...typescriptConfig,
    plugins: {
      ...typescriptConfig.plugins,
      'unused-imports': unusedImports,
    },
    rules: {
      ...typescriptConfig.rules,
      'unused-imports/no-unused-imports': 'error',
    },
  },
]
```

---
