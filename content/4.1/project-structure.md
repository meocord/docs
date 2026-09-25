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
