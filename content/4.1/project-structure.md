---
id: project-structure
title: Project structure
section: Start
order: 3
---

`meocord create` writes this layout, plus a README, `.gitignore` and `.prettierrc.mjs`. Nothing in it is required by the framework except `meocord.config.ts`
at the root and the entry point, `src/main.ts`; the folders are a convention that `meocord generate`
follows.

```text
.
├── .env.example            # copy to .env and fill in DISCORD_TOKEN
├── meocord.config.ts       # the token, the build hook, command registration
├── eslint.config.ts        # extends meocord/eslint
├── vitest.config.ts
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
    └── services/
```

Each sample has a `.spec.ts` beside it. `src/main.ts` creates the app from `src/app.ts` with
`MeoCordFactory.create(App)` and starts it. `meocord build` bundles it with Rsbuild into `dist/`, and
`meocord start` runs `dist/main.js`, building it first under `--dev` or with `--build`.

## Adding to it

`meocord generate` writes a controller, its spec and, for commands, its builder. It does not touch
`src/app.ts`: add the new class to `controllers` there. A controller missing from the list is never bound,
and its commands are never registered. See [the CLI](/docs/4.1/cli) for every generator.

## Growing by feature

The generated layout groups files by kind, which suits a bot with a handful of commands. Once a feature has
several parts, such as a command, a modal, buttons, a service and a guard, keeping them together is easier to
read and to delete as a unit:

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

MeoCord finds nothing by folder, so either layout works, and both can live in one project. The
[tutorial](/docs/4.1/tutorial) keeps its whole bot in one folder this way.

A few things belong at the top of `src`, whichever layout you choose:

- **`i18n.ts` and `locales/`**, since every feature's builders and replies use the same translator. See
  [Localisation](/docs/4.1/localisation).
- **Presenters, and guards several features share.**
- **Nothing that reads `process.env` at import time**, other than `meocord.config.ts`. Read settings in a
  service instead, which a test can replace; the tutorial's
  [`FeedbackSettings`](/docs/4.1/tutorial-components) is an example.

## Imports

`@src/*` resolves to `src/*`. `tsconfig.json` declares it for the typechecker, the build resolves it, and
`vitest.config.ts` gives Vitest the same alias. Prefer it to long relative paths: a file moved to another
folder keeps its imports.

## The three tsconfigs

| File                   | Checks                                    | Why it exists                                                             |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `tsconfig.json`        | `src`, without specs, and the config file | What ships. `noEmit`: Rsbuild compiles, TypeScript only checks            |
| `tsconfig.test.json`   | `src` with the specs                      | Adds Vitest's global types, which the app itself must not see             |
| `tsconfig.eslint.json` | the config files at the root              | Lets ESLint's type-aware rules read `eslint.config.ts` and its neighbours |

`npm run lint` runs ESLint, then `tsc` against the first two, so a type error in a spec fails as surely as
one in the app.

## What the build writes

`meocord build` writes `dist/`:

```text
dist/
├── main.js                 # the bot, bundled
├── meocord.config.mjs      # the config, compiled, which the bot loads at startup
├── assets/                 # images, fonts and media your code imports
└── node_modules/           # native addons, with bundleDependencies only
```

The bot reads its config from `dist`, not from `meocord.config.ts`, so a change to the config takes a new
build. [Deployment](/docs/4.1/deployment) covers what the server needs beside `dist`, and
[Self-contained builds](/docs/4.1/self-contained-builds) covers `bundleDependencies`.
