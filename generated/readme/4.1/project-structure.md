---
id: project-structure
title: 'Project Structure'
order: 4
source: readme@4.1.0-beta.0
---

<details>
<summary><b>The generated file tree</b></summary>

```
.
├── README.md
├── .env.example
├── .gitignore
├── .prettierrc.mjs
├── meocord.config.ts
├── eslint.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.eslint.json
├── tsconfig.test.json
├── package.json
└── src
    ├── main.ts                         # Entry point — bootstraps the app
    ├── app.ts                          # Root module — registers controllers and services
    ├── controllers
    │   ├── slash
    │   │   ├── builders/               # Slash command option/subcommand builders
    │   │   ├── sample.slash.controller.ts
    │   │   └── sample.slash.controller.spec.ts
    │   ├── button
    │   │   ├── sample.button.controller.ts
    │   │   └── sample.button.controller.spec.ts
    │   ├── select-menu
    │   │   ├── sample.select-menu.controller.ts
    │   │   └── sample.select-menu.controller.spec.ts
    │   ├── modal-submit
    │   │   ├── sample.modal-submit.controller.ts
    │   │   └── sample.modal-submit.controller.spec.ts
    │   ├── context-menu
    │   │   ├── builders/               # Context menu command builders
    │   │   ├── sample.context-menu.controller.ts
    │   │   └── sample.context-menu.controller.spec.ts
    │   ├── message
    │   │   ├── sample.message.controller.ts
    │   │   └── sample.message.controller.spec.ts
    │   └── reaction
    │       ├── sample.reaction.controller.ts
    │       └── sample.reaction.controller.spec.ts
    ├── guards
    │   ├── owner.guard.ts
    │   └── owner.guard.spec.ts
    ├── presenters
    │   ├── app.presenter.ts
    │   └── app.presenter.spec.ts
    └── services
        ├── sample.service.ts
        └── sample.service.spec.ts
```

</details>

---
