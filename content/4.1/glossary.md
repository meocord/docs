---
id: glossary
title: Glossary
chapter: appendix
group: help
order: 4
summary: The words the Guide uses, what each means in MeoCord, and the chapter that explains it.
requires: []
api: []
since: 4.1.0
formerly: []
---

The words the Guide uses, and what each means in MeoCord.

**Acknowledgement.** The first answer to an interaction, which Discord requires within three seconds: a reply, a
deferral, an update or a modal. See [Responses](guide:responses).

**Builder.** A class decorated with `@CommandBuilder` that describes a command for Discord to register: its name,
description and options. See [Slash commands](guide:slash-commands).

**Catalog.** The messages of one language, keyed by name, which a translator reads. The default catalog is typed, and
a `meocord` group in any catalog translates MeoCord's own texts. See [Localisation](guide:localisation).

**Component.** A button, select menu or modal, which comes back to the bot with the `customId` it was given. See
[Buttons, selects and modals](guide:components).

**Container.** Where MeoCord keeps the app's instances, and makes them for whatever injects them. See
[Services and injection](guide:services).

**Controller.** A class decorated with `@Controller` whose methods are handlers. One instance serves the whole app.
See [Your first command](guide:first-command).

**Cooldown.** A limit on how often a handler runs, per user, channel, server or everyone. See
[Cooldowns](guide:cooldowns).

**Cooldown store.** Where cooldowns count calls: the bot's memory by default, or the shard manager, Redis or a
database of your own. See [Cooldown stores](guide:recipes/cooldown-stores).

**`customId` pattern.** A component's route, such as `profile/{ownerId}/{uid}`. The parts in braces become the
handler's params. See [Patterns](guide:components#patterns).

**Deferral.** An acknowledgement that answers later: a deferred reply shows that the bot is thinking, and a deferred
update leaves a component's message as it is. `@Defer` defers for a handler. See [@Defer](guide:defer).

**Development guild.** The server that receives every command under `meocord start --dev`, where commands update at
once. See [Registering commands](guide:slash-commands#registering-commands).

**Dispatch.** Finding the handler for what the bot receives, and running it. See
[Dispatch](guide:overview#dispatch).

**Exception filter.** A class that handles the errors of the types it names, from any stage of a call or from the
handler. See [Exception filters](guide:exception-filters).

**Fallback.** What answers an error no exception filter handles. After an interaction, the user gets a generic
message and the error is logged. After a message, a usage error, a guard's reason and a `UserError` are replied to,
and an unexpected error is logged, and told to the author in a direct message only with `dmOnError`. It also answers
a component no route takes, "Command not found!". See
[The built-in fallback](guide:exception-filters#the-built-in-fallback).

**Guard.** A class that decides whether a handler runs. A new one is made for every call, unless it's bound: supplied
by a provider, listed in `services` or injected by another class, in which case every call shares one instance. See
[Guards](guide:guards).

**Handler.** A method MeoCord calls for a command, component, autocomplete request, message, reaction or event.

**Install context.** Where an interaction happened, and how the app was installed there: a server, a direct message
with the bot, or a user-installed app in another conversation. See
[Where the interaction happened](guide:install-contexts).

**Interceptor.** A class that runs around a handler once its guards let the call through, for timing, logging or
caching. See [Interceptors](guide:interceptors).

**Lock.** What `@Defer` does to a component's message while its handler runs: it disables the controls, marks the one
clicked, and puts them back afterwards. See [@Defer](guide:defer).

**Message command.** A `@MessageHandler` with a pattern, such as `roll {sides}`, run for a message that matches it
after the app's prefix. See [Message commands](guide:message-commands).

**Metadata.** A fact declared on a handler or a controller with a decorator that `createMetadata` makes, which guards,
interceptors and the handler registry read. See [Custom decorators](guide:custom-decorators).

**Observer.** A class told about every call MeoCord dispatches, and about interactions no handler matches: once it has
settled, with how it ended and how long it took, and optionally as it starts. For metrics, audit logs and tracing. See
[Observers](guide:observers).

**Params.** What a handler receives after the interaction or message: a command's options, the parts of a `customId`
pattern, a modal's fields, a select menu's `values`, or the params of a message pattern.

**Pipe.** A class that turns a handler's validated input into what the handler wants, such as an id into a record. See
[Validation and pipes](guide:validation).

**Pipeline.** Every stage MeoCord runs around a handler, in order. See [How a call runs](guide:how-a-call-runs).

**Presenter.** A class that decides how MeoCord's own answers look: the loading view of `@Defer`, the error answer of
the fallback, and the reply of the built-in `!help`. See [Presenters](guide:presenters).

**Primary process.** The one process that should do one-off work: the only process, or with process sharding the one
running shard 0. `onReady` receives it as `primary`. See [Lifecycle hooks](guide:lifecycle-hooks#onready).

**Provider.** A value, a class or a factory that `@MeoCord({ providers })` supplies under a token, for classes to
inject. See [Providers](guide:services#providers).

**Route.** A `customId` pattern made with `route()`, which `@Command` takes and which builds the ids it matches. See
[Building customIds with a route](guide:components#building-customids-with-a-route).

**Scope.** Where commands are registered: globally, to listed servers, or to the development guild. See
[Registering commands](guide:slash-commands#registering-commands). A message command's `scope` says instead where it
works: `'guild'`, `'dm'` or `'any'`. See
[Aliases, descriptions and scope](guide:message-commands#aliases-descriptions-and-scope).

**Service.** A class decorated with `@Service` that holds logic or state for controllers and other services to
inject. One instance serves the whole app. See [Services and injection](guide:services).

**Shard.** One of the gateway connections a large bot splits into. See [Sharding](guide:sharding).

**Stage.** One step of the pipeline: `@Defer`'s acknowledgement, parsing a message's words, guards, the cooldown
check, fetching what a message names, interceptors, validation, pipes, cooldowns and the lock. Exception filters
surround them, and observers frame the whole call. See [How a call runs](guide:how-a-call-runs).

**Theme.** The colours, emojis and button styles a bot's answers use, named by what they mean, such as `danger`. See
[Theming](guide:theming).

**Token.** The key a provider supplies a value under, and that `@Inject(token)` asks for: a class, a string, a symbol,
or a typed token from `createToken`. See [Providers](guide:services#providers).

**Translator.** What `createTranslator` returns: it picks the language for a message, from the user, the server or a
locale you give it. Given to `@MeoCord({ i18n })`, it translates MeoCord's own texts too. See
[Localisation](guide:localisation).

**Typed param.** A param whose pattern names its type, such as `{count:int}`, so the handler receives the value
rather than its text. See [Typed params](guide:components#typed-params).

**`UserError`.** An error for the user's own mistake, not logged as a fault. After an interaction it's shown only to the
user who made the call; after a message it's a reply that doesn't ping the author. See
[Exception filters and UserError](guide:exception-filters).
