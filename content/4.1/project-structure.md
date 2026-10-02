---
id: project-structure
title: Project structure
chapter: start
order: 4
summary: What each file of a new project is for, where new code goes as a bot grows, and what the build writes.
learn:
  - Find your way around the files the create command writes
  - Choose between grouping files by kind and by feature
  - Tell what the build writes to dist, and what the bot reads from it
requires: [getting-started]
api: [decorators/MeoCord, configuration/MeoCordConfig]
---

The `create` command writes a project laid out by kind: controllers in one folder, services in another. Nothing in it is
required by MeoCord except `meocord.config.ts` at the root and the entry point, `src/main.ts`; the folders are a
convention `meocord generate` follows, and you can lay a bot out by feature instead.

## When to use it

Read this once a new project is running, before you add to it, and again when a bot outgrows the layout it started
with.

## Example

The layout the `create` command writes, besides a README, `.gitignore`, `.prettierrc.mjs` and the package manager's
lockfile, and it makes the folder a git repository:

```text
.
├── .env.example            # copy to .env and fill in DISCORD_TOKEN
├── meocord.config.ts       # the token, the build hook, command registration
├── eslint.config.ts        # extends meocord/eslint
├── vitest.config.ts
├── vitest.setup.ts         # resets MeoCord's mocks after every test
├── tsconfig.json           # the app
├── tsconfig.test.json      # the app and its specs
├── tsconfig.eslint.json    # what ESLint type-checks
├── package.json
└── src
    ├── main.ts             # starts the app
    ├── app.ts              # the @MeoCord class: controllers, services, client options
    ├── controllers
    │   ├── slash/          # slash commands, with their builders under builders/
    │   ├── button/
    │   ├── select-menu/
    │   ├── modal-submit/
    │   ├── context-menu/   # context menu commands, with their builders under builders/
    │   ├── message/
    │   └── reaction/
    ├── guards/
    ├── presenters/         # how loading and error views look
    ├── services/
    └── types/              # declarations for asset imports, and for theme tokens of your own
```

Each sample has a `.spec.ts` beside it.

## How it works

`src/main.ts` creates the app from `src/app.ts` with `MeoCordFactory.create(App)` and starts it. `meocord build`
bundles it with Rsbuild into `dist/`, and `meocord start` runs `dist/main.js`, building it first under `--dev` or with
`--build`. MeoCord finds nothing by folder: a controller runs because `src/app.ts` lists it, wherever its file is.

### Adding to it

`meocord generate` writes a controller, its spec and, for commands, its builder, into the folder for its kind. It
doesn't touch `src/app.ts`: add the new class to `controllers` there. A controller missing from the list is never bound,
and its commands are never registered. [The CLI](guide:cli) lists every generator.

### Growing by feature

Grouping by kind suits a bot with a handful of commands. Once a feature has several parts, such as a command, a form,
buttons, a service and a guard, keeping them together is easier to read, and to delete as a unit:

```text
src
├── main.ts
├── app.ts
├── i18n.ts
├── locales/
├── feedback/
│   ├── feedback.builder.ts
│   ├── feedback.controller.ts
│   ├── feedback.controller.spec.ts
│   ├── feedback.service.ts
│   ├── review.controller.ts
│   └── staff.guard.ts
└── shared/
    ├── guards/
    └── presenters/
```

Either layout works, and both can live in one project. A few things belong at the top of `src`, whichever you choose:

- **`i18n.ts` and `locales/`**, since every feature's builders and replies use the same translator. See
  [Localisation](guide:localisation).
- **Presenters, and guards several features share.**
- **Nothing that reads `process.env` at import time**, other than `meocord.config.ts`. Read settings in a service
  instead, which a test can replace. See [Configuration](guide:configuration).

### Imports

`@src/*` resolves to `src/*`. `tsconfig.json` declares it for the typechecker, the build resolves it, and
`vitest.config.ts` gives Vitest the same alias. Prefer it to long relative paths: a file moved to another folder keeps
its imports.

The build reads your `paths` as TypeScript does: from `compilerOptions.baseUrl` when your `tsconfig.json` sets one,
else from the `tsconfig.json` itself. A `baseUrl` it only inherits through `extends` isn't applied to the `paths` it
sets, so declare those relative to the project's own `tsconfig.json`.

### The three tsconfigs

| File                   | Checks                                    | Why it exists                                                             |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `tsconfig.json`        | `src`, without specs, and the config file | What ships. `noEmit`: Rsbuild compiles, TypeScript only checks            |
| `tsconfig.test.json`   | `src` with the specs                      | Adds Vitest's global types, which the app itself must not see             |
| `tsconfig.eslint.json` | the config files at the root              | Lets ESLint's type-aware rules read `eslint.config.ts` and its neighbours |

`npm run lint` runs ESLint, then `tsc` against the first two, so a type error in a spec fails as surely as one in the
app.

### What the build writes

```text
dist/
├── main.js                 # the bot, bundled
├── meocord.config.mjs      # the config, compiled, which the bot loads at startup
├── assets/                 # images, fonts and media your code imports
└── node_modules/           # native addons, with bundleDependencies only
```

The bot reads its config from `dist`, not from `meocord.config.ts`, so a change to the config takes a new build.
[Deployment](guide:deployment) covers what a server needs beside `dist`, and
[Self-contained builds](guide:self-contained-builds) covers `bundleDependencies`.

## Gotchas

- **A generated file isn't listed for you.** Add each controller `meocord generate` writes to `src/app.ts`.
- **Editing `meocord.config.ts` takes a new build** before a bot started with `--prod` sees it. `--dev` rebuilds on its
  own.
- **`.env` stays out of git.** The generated `.gitignore` lists it; keep it there.

## Build it

The feedback bot is one feature, so its files live together in one folder, `src/tutorial/`, which is where the imports
in the chapters after this one point. Create it:

```bash
mkdir src/tutorial
```

Leave the samples in place for now: they keep the project building and its specs passing while the feedback bot takes
shape beside them, and you can delete each one, with its line in `src/app.ts`, once you no longer want it.

## Next steps

- [Slash commands](guide:slash-commands): the feedback bot's `/feedback` command, and every option a command can take.
- [Services](guide:services): what a controller can ask for, and how long each instance lives.
- [Configuration](guide:configuration): what `meocord.config.ts` sets.
