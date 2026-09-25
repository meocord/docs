---
id: services
title: Services and injection
section: Core
order: 16
---

A service is a class marked with `@Service()`. It holds what handlers share: an API client, a database
connection, a cache, the logic a command calls. A controller, or another service, gets one by declaring it
in its constructor, and MeoCord passes it in.

::example{file="services/greeting.service.ts" region="service"}

Every controller and service is a singleton: one instance serves every call. Keep
per-call state in the handler, not on the instance.

## What you can inject

- **Your own services**, and whatever they inject in turn. A controller that injects a service is enough to
  bind it; nothing has to be listed.
- **The discord.js `Client`**, the one the bot logs in with.
- **`HandlerRegistry`** from `meocord/core`, which lists every handler, and **`ShardContext`**, which reaches
  every shard.
- **`Translator`**, when the app configures `i18n`.

## Services nothing injects

A service that no controller or other service depends on, but that must still exist, such as a scheduler or
a queue consumer, is listed in the app's `services`:

::example{file="app-with-services.ts" region="app"}

This one sets the bot's status once it is ready, through the `onReady` lifecycle hook:

::example{file="services/status.service.ts" region="service"}

## Testing a service

`MeoCordTestingModule` builds a container from the classes you give it. Unlike the app, it binds only what
you list, so a test decides each dependency: the real class, or a stand-in with `useValue`.

::example{file="services/status.service.spec.ts"}
