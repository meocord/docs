---
id: subcommands
title: Subcommands
section: Core
order: 14
---

Discord sends `/settings notify email` as one interaction named `settings`, so without more a command with
subcommands has one handler for all of them. Name the full path instead, its parts separated by spaces as
Discord displays them, to give each subcommand a method of its own.

The builder describes the command once, subcommands and groups included:

::example{file="controllers/slash/builders/settings.builder.ts" region="builder"}

::example{file="controllers/slash/settings.slash.controller.ts" region="controller"}

A subcommand handler takes plain `CommandType.SLASH` and no builder: the parent's builder already describes
it, and Discord would reject a second command for it. Its options are flattened, so `notifyEmail` receives
`{ enabled }` rather than the subcommand around it.

The full path is always tried before the bare command name, and a subcommand no method claims falls back to
the command's own handler. A group is never skipped on the way: `settings notify email` does not fall back
to `settings email`, since another group could declare its own `email`.

::example{file="controllers/slash/settings.slash.controller.spec.ts"}
