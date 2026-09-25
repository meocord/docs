---
id: features
title: 'Features'
order: 2
source: readme@4.0.0
---

- **Decorator-based controllers** — Handle every Discord interaction type — slash commands and their subcommands, autocomplete, buttons, modals, all five select menus, context menus, activity entry points, messages, and reactions — with `@Command`, `@Autocomplete`, `@Controller`, and `@UseGuard` decorators. No routing boilerplate.
- **Dependency injection** — Built on Inversify. Services are wired into controllers automatically; no manual instantiation or service locators.
- **Guard system** — Pre-execution hooks for auth, rate limiting, metrics, and anything else. Apply per-method or per-class with `@UseGuard`. Guards receive the full interaction context.
- **Full CLI** — `meocord create`, `build`, `start`, `generate`. Scaffolds controllers, services, and guards; builds with Rsbuild for both development and production.
- **Testing utilities** — `MeoCordTestingModule`, `createMockInteraction`, `createMockMessage`, `createMockUser`, `createMockClient`, `createMockGuild`, `createMockChannel`, `createChatInputOptions`, and `overrideGuard` let you test controllers against real guard logic without a Discord connection. Type guards and reply state machines work out of the box.
- **TypeScript-first** — Strict types throughout. Decorator metadata, `DeepMocked<T>` for test mocks, and typed config interfaces included.
- **Extensible build** — An Rsbuild config hook in `meocord.config.ts` to adjust the build without ejecting, and an option to bundle dependencies so production runs without `node_modules`.

---
