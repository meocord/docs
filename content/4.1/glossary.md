---
id: glossary
title: Glossary
section: Core
order: 17
since: 4.1.0
---

The words the guides use, and what each means in MeoCord.

**Acknowledgement.** The first answer to an interaction, which Discord requires within three seconds: a reply,
a deferral, an update or a modal. See [Answering with respond()](/docs/4.1/responses).

**Builder.** A class decorated with `@CommandBuilder` that describes a command for Discord to register: its
name, description and options. See [Commands and components](/docs/4.1/command-types).

**Component.** A button, select menu or modal, which comes back to the bot with the `customId` it was given.

**Container.** Where MeoCord keeps the app's instances and makes them for whoever injects them. See
[Services and injection](/docs/4.1/services).

**Controller.** A class decorated with `@Controller` whose methods are handlers. One instance serves the whole
app.

**Cooldown.** A limit on how often a handler runs, per user, channel, server or everyone. See
[Cooldowns](/docs/4.1/cooldowns).

**`customId` pattern.** A component's route, such as `profile/{ownerId}/{uid}`; the parts in braces become the
handler's params. See [Routing components](/docs/4.1/component-routing).

**Deferral.** An acknowledgement that answers later: a deferred reply shows that the bot is thinking, and a
deferred update leaves a component's message as it is. `@Defer` defers for a handler. See
[@Defer](/docs/4.1/defer).

**Development guild.** A server that receives every command while the bot runs in development, where
commands update at once. See [Registering commands](/docs/4.1/command-registration).

**Dispatch.** Finding the handler for what the bot receives, and running it. See
[How MeoCord fits together](/docs/4.1/concepts#dispatch).

**Exception filter.** A class that handles errors of the types it names, from a handler, its interceptors or
its guards. See [Exception filters](/docs/4.1/exception-filters).

**Guard.** A class that decides whether a handler runs. A new one is made for every call. See
[Guards](/docs/4.1/guards).

**Handler.** A method MeoCord calls for a command, component, autocomplete request, message, reaction or
event.

**Install context.** Where an interaction happened, and how the app was installed there: a server, a direct
message with the bot, or a user-installed app in another conversation. See
[Where the interaction happened](/docs/4.1/install-contexts).

**Interceptor.** A class that runs around a handler once its guards allow the call, for timing, logging or
caching. See [Interceptors](/docs/4.1/interceptors).

**Lock.** What `@Defer` does to a component's message while its handler runs: disables the controls, marks
the one clicked, and puts them back after. See [@Defer](/docs/4.1/defer).

**Metadata.** A fact declared on a handler or controller with a decorator made by `createMetadata`, which
guards, interceptors and the handler registry read. See [Custom decorators](/docs/4.1/custom-decorators).

**Params.** What a handler receives after the interaction: a command's options, or the parts of a
`customId` pattern and a modal's fields.

**Pipe.** A class that turns a handler's validated input into what the handler wants, such as an id into a
record. See [Validation and pipes](/docs/4.1/validation).

**Pipeline.** Everything MeoCord runs around a handler, in order. See
[How a call runs](/docs/4.1/how-a-handler-runs).

**Presenter.** A class that decides how MeoCord's own answers look, such as errors and cooldown notices. See
[Presenters](/docs/4.1/presenters).

**Primary process.** The one process that should do one-off work: the only process, or with process sharding
the one running shard 0. `onReady` receives it as `primary`. See [Lifecycle hooks](/docs/4.1/lifecycle-hooks).

**Scope.** Where commands are registered: globally, to listed servers, or to the development guild. See
[Registering commands](/docs/4.1/command-registration).

**Service.** A class decorated with `@Service` that holds logic or state for controllers and other services
to inject. One instance serves the whole app.

**Shard.** One of the gateway connections a large bot splits into. See [Sharding](/docs/4.1/sharding).

**Stage.** One step of the pipeline: a guard, an interceptor, validation, a pipe, a cooldown or an exception
filter.
