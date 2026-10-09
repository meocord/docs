---
id: custom-decorators
title: Custom decorators
chapter: pipeline
order: 8
summary: Give a set of stages one name of your own, and attach typed facts to handlers for guards and other stages to read.
learn:
  - Combine guards, cooldowns and other decorators into one
  - Attach a typed fact to a handler with createMetadata
  - Read that fact from a guard, an interceptor or a filter
requires: [guards, cooldowns]
api: [utilities/applyDecorators, utilities/createMetadata, utilities/SetMetadata, types/MetadataDecorator]
since: 4.1.0
---

A bot soon repeats itself: the same guard with the same settings and the same cooldown on a dozen commands.
[`applyDecorators`](api:utilities/applyDecorators) combines decorators into one of your own, so the combination is
written once and named for what it means.

For facts about a handler, such as the roles it requires, [`createMetadata`](api:utilities/createMetadata) makes a
typed decorator that stores a value any stage can read back.

## When to use it

Use `applyDecorators` when two or more handlers share the same stages with the same settings. A decorator named
`@Protected` or `@StaffOnly` says what a handler is, where a stack of four decorators says how.

Use `createMetadata` when a stage needs something to know about the handler it runs for. When the value configures one
use of a stage instead, such as the channels one command is allowed in, pass it as that stage's `{ provide, params }`,
as [Guards](guide:guards#settings-for-one-use) shows.

## Example

This decorator applies a guard with its settings and a cooldown:

::example{file="decorators/protected.decorator.ts" region="decorator"}

A handler takes it like any decorator:

::example{file="controllers/slash/shop.slash.controller.ts" region="use"}

`/shop` now runs only in that channel, at most once every ten seconds per user.

## How it works

`applyDecorators` returns a decorator that applies each one it was given to the class or the method it decorates, as
they would apply written one above the other: `applyDecorators(A, B)` does what `@A @B` does, so guards run in the
order listed. It works on a controller as well as on a handler, as long as every decorator in it does.

The handler ends up with exactly what the combined decorators give it, and
[`inspectHandler`](api:testing/inspectHandler) shows it:

::example{file="controllers/slash/shop.slash.controller.spec.ts" region="spec"}

A decorator of your own that passes options on types them with the wrapped decorator's options type: `DeferOptions`
from `meocord/decorator` for `@Defer`, and from `meocord/interface`, `CooldownOptions` for `@Cooldown`, and
`GuardOptions`, `InterceptorOptions`, `ObserverOptions` and `ValidateOptions` for the stage classes and `@Validate`.

## Facts about a handler

`createMetadata<T>()` returns a decorator that stores a value of type `T` on a handler or a controller. A stage reads it
with `ExecutionContext.get(decorator)`, and a handler's value wins over its controller's. Each one has a unique key, so
two never collide:

::example{file="guards/roles.guard.ts" region="guard"}

`RequireRoles` combines the metadata and the guard that reads it, so a handler takes one decorator for both.
`ExecutionContext.getAll(decorator)` reads every value declared, the method's first, then the controller's.

## String keys

[`SetMetadata(key, value)`](api:utilities/SetMetadata) stores a value under a key of your choosing, read with
`ExecutionContext.get(key)`. Both are deprecated, and removed in the next major version (5.0): each logs a warning
once. Use `createMetadata`, whose values are typed and whose key can't collide with another library's. `SetMetadata`
throws as it applies for a key beginning `meocord:`, where MeoCord keeps its own metadata, and for the two keys
dependency injection reads; see the
[upgrade guide](guide:migrating#setmetadata-refuses-meocords-own-keys).

## Gotchas

- **A bot written for 4.0 relied on the reverse order.** 4.0's `applyDecorators(UseGuard(A), UseGuard(B))` ran `B`
  before `A`; 4.1 runs `A` first, as stacking them does. To keep the old order, list them the other way round; see
  the [upgrade guide](guide:migrating#applydecorators-applies-its-decorators-in-the-order-they-stack).
- **A method-only decorator can't go on a controller.** `@Defer`, `@Validate` and `@UsePipe` go on handlers only,
  and refuse a class as they apply, naming the decorator, so a custom decorator that includes them does too.

## Next steps

- [Guards](guide:guards): read a handler's metadata from a guard.
- [Testing](guide:testing): check what a handler ends up with through `inspectHandler`.
- [Structuring your app](guide:services): share the services your stages inject.
