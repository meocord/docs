---
id: glossary
title: Glossary
chapter: appendix
group: help
order: 5
summary: The words the Guide uses, what each means in MeoCord, and the chapter that explains it.
requires: []
api: []
since: 4.1.0
formerly: []
terms: true
---

The words the Guide uses, and what each means in MeoCord.

**Acknowledgement.** The first answer to an interaction, which Discord requires within three seconds: a reply, a
deferral, an update, a modal, or, for an activity's entry point command, launching the activity. An autocomplete is
answered with its choices instead. See [Responses](guide:responses).

**App class.** The class `@MeoCord` decorates: it lists the app's controllers, services, providers, global stages and
client options, and `main.ts` starts it. See [Overview](guide:overview).

**Autocomplete.** The suggestions Discord asks for while a user types an option; an `@Autocomplete` handler answers
within three seconds. See [Autocomplete](guide:autocomplete).

**Builder.** A class decorated with `@CommandBuilder` that describes a command for Discord to register: its name,
description and options. See [Slash commands](guide:slash-commands).

**Call.** One run of a handler, through its pipeline, for an interaction, a message, a reaction or an event. A
message no handler matches is not a call.

**Catalog.** The messages of one language, keyed by name, which a translator reads. The default catalog is typed, and
a `meocord` group in any catalog translates MeoCord's own texts. See [Localisation](guide:localisation).

**Collector.** A discord.js listener for one message's components; MeoCord leaves an unrouted component to it for 1.5
seconds. See [Collectors](guide:components#collectors).

**Component.** A button, select menu or modal, which comes back to the bot with the `customId` it was given. See
[Buttons, selects and modals](guide:components).

**Container.** Where MeoCord keeps the app's instances, and makes them for whatever injects them. See
[Services and injection](guide:services).

**Context menu command.** A command on a user's or a message's right-click menu. See
[Context menus](guide:context-menus).

**Controller.** A class decorated with `@Controller` whose methods are handlers. One instance serves the whole app.
Commands, components, messages and reactions reach only the controllers in `@MeoCord({ controllers })`; such a handler
on a service never runs, and the bot warns at startup. See [Your first command](guide:first-command).

**Cooldown.** A limit on how often a handler runs, per user, channel, server or everyone, and optionally apart for each
value of the call with `by`. See [Cooldowns](guide:cooldowns).

**Cooldown store.** Where cooldowns count calls: the bot's memory by default, or the shard manager, Redis or a
database of your own. See [Cooldown stores](guide:recipes/cooldown-stores).

**`customId` pattern.** A component's route, such as `profile/{ownerId:snowflake}/{uid}`. The parts in braces become the
handler's params. See [Patterns](guide:components#patterns).

**Deferral.** An acknowledgement that answers later: a deferred reply shows that the bot is thinking, and a deferred
update leaves a component's message as it is. `@Defer` defers for a handler. See [@Defer](guide:defer).

**Development guild.** The server that receives every command under `meocord start --dev`, where commands update at
once. See [Registering commands](guide:slash-commands#registering-commands).

**Dispatch.** Finding the handler for what the bot receives, and running it. See
[Dispatch](guide:overview#dispatch).

**Exception filter.** A class that answers the errors of the types it names, or every error when it names none: from
any stage of a call or from the handler, and, for the app's global filters, from outside any handler, such as
`CommandNotFoundError`. See [Exception filters](guide:exception-filters).

**Execution context.** What a stage reads about the call it runs for: the interaction or message, the handler and its
params, the metadata on it, and its answer through `response`. A guard injects `ExecutionContext`; an interceptor,
filter, pipe and observer receive it. Each call gets its own. See [How a call runs](guide:how-a-call-runs).

**Fallback.** What answers an error no exception filter handles. After an interaction, a guard's reason, a cooldown,
invalid input and a `UserError` are shown only to the user, and any other error gets a generic message and is logged.
After a message command, a usage error, a guard's reason and invalid input are replied to, and the reply is deleted
after `deleteUsageRepliesAfter` seconds, 10 by default. A usage error gets no reply when the message had no prefix or
mention, since it may be chat. A `UserError` is replied to after any message. A cooldown is skipped without a word,
unless `dmOnCooldown` tells the author. An unexpected error is logged, and told to the author in a direct message only
with `dmOnError`. A guard on a message listener without a pattern, or on a reaction, only filters: its reason is logged,
not sent. It also answers an interaction no handler takes, "Command not found!", except an autocomplete, which gets an
empty menu. See [The built-in fallback](guide:exception-filters#the-built-in-fallback).

**Guard.** A class that decides whether a handler runs. A new one is made for every call, unless it's bound: supplied
by a provider, listed in `services` or injected by another class, in which case every call shares one instance. See
[Guards](guide:guards).

**Handler.** A method MeoCord calls for a command, component, autocomplete request, message, reaction or event.

**Handler registry.** `HandlerRegistry` from `meocord/core`, which lists every handler with what was declared on it.
See [Handler discovery](guide:handler-discovery).

**Install context.** Where an interaction happened, and how the app was installed there: a server, a direct message
with the bot, or a user-installed app in another conversation. See
[Where the interaction happened](guide:install-contexts).

**Interceptor.** A class that runs around a handler once its guards let the call through, for timing, logging or
caching. See [Interceptors](guide:interceptors).

**Lifecycle hook.** `onReady`, run once the client is ready, in dependency order, and `onShutdown`, run as the bot
stops, on a service, controller, provided value or observer. See [Lifecycle hooks](guide:lifecycle-hooks).

**Loading view.** What `@Defer` adds to a component's message while its handler runs, drawn by the presenter's
`loading()`. See [@Defer](guide:defer).

**Lock.** What `@Defer` does to a component's message once the call is allowed: it disables the controls (every one,
or only the one clicked, as `disable` says), shows the loading emoji on the clicked button and adds the loading view;
the handler's answer, or its return, puts them back. `respond(interaction).lock()` does the same from code. See
[@Defer](guide:defer).

**Message command.** A `@MessageHandler` with a pattern, such as `roll {sides}`, run for a message that matches it after
a prefix, the app's or the handler's own, or a mention of the bot when `mention` is on. With no prefix set, or
`prefix: false` on the handler, it matches the message as it is. See [Message
commands](guide:message-commands).

**Metadata.** A fact declared on a handler or a controller with a decorator `createMetadata` makes. Any stage reads it
through the call's `ExecutionContext`, and the handler registry lists it. See [Custom
decorators](guide:custom-decorators).

**Observer.** A class told about every call MeoCord dispatches, and about interactions no handler matches: once it has
settled, with how it ended and how long it took, and optionally as it starts. For metrics, audit logs and tracing. See
[Observers](guide:observers).

**Params.** What a handler receives after the interaction or message: a command's or autocomplete's options, the parts
of a `customId` pattern, a modal's fields, what a select menu's user chose (`values`, and the users, members, roles or
channels of an entity select), or the params of a message pattern.

**Pipe.** A class that turns one value of a handler's input, after any validation, into what the handler wants, such as
an id into a record. See [Validation and pipes](guide:validation).

**Pipeline.** Every stage MeoCord runs around a handler, in order. See [How a call runs](guide:how-a-call-runs).

**Prefix.** What a message command starts with, set for the app in `@MeoCord({ messages })` or on one handler. See
[Prefixes](guide:message-commands#prefixes).

**Presenter.** A class that decides how MeoCord's own answers look: the loading view of `@Defer`, every error view sent
with `respond().error()` (the fallback's and a filter's alike), error replies to messages and the direct messages
`dmOnError` and `dmOnCooldown` send, and the reply of the built-in help. See [Presenters](guide:presenters).

**Primary process.** The one process that should do one-off work: the only process, or with process sharding the one
running shard 0. `onReady` receives it as `primary`. See [Lifecycle hooks](guide:lifecycle-hooks#onready).

**Provider.** A value, a class or a factory that `@MeoCord({ providers })` supplies under a token, for classes to
inject. See [Providers](guide:services#providers).

**Response.** What `respond(interaction)` returns: it answers an interaction with the right Discord call for where the
answer stands. See [Responses](guide:responses).

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

**Subcommand.** An action under a slash command, `/ticket close`, described in the parent's builder and handled by its
own method. See [Subcommands](guide:subcommands).

**Testing module.** `MeoCordTestingModule` from `meocord/testing`: `invoke` runs one handler through its pipeline, and
`dispatch` routes input as the bot does. See [Testing](guide:testing).

**Theme.** The colours, emojis and button styles a bot's answers use, named by what they mean, such as `danger`. See
[Theming](guide:theming).

**Token.** The key a provider supplies a value under, and that `@Inject(token)` asks for: a class, a string, a symbol,
or a typed token from `createToken`. See [Providers](guide:services#providers).

**Translator.** What `createTranslator` returns: it picks a text's language from an interaction's user (or its server,
for a public answer), from a server, or from a locale you give it. Given to `@MeoCord({ i18n })`, it translates
MeoCord's own texts too. See [Localisation](guide:localisation).

**Typed param.** A param whose pattern names its type, such as `{count:int}`, so the handler receives the value
rather than its text. See [Typed params](guide:components#typed-params).

**Usage error.** A message that names a command but doesn't fit its pattern: a param left out, a word of the wrong
type, a flag the command lacks, or a command sent where it doesn't work. It's raised as `MessageUsageError` and
answered with the command's usage. See [Usage errors](guide:message-commands#usage-errors).

**`UserError`.** An error for the user's own mistake, not logged as a fault. After an interaction it's shown only to the
user who made the call; after a message it's a reply that doesn't ping the author. See
[Exception filters and UserError](guide:exception-filters).
