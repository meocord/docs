---
id: custom-decorators
title: Custom decorators
section: Handling a call
order: 36
---

`applyDecorators` from `meocord/common` combines decorators into one of your own, so a combination a bot uses
in many places, a guard with its options and a cooldown say, is written once:

::example{file="decorators/protected.decorator.ts" region="decorator"}

::example{file="controllers/slash/shop.slash.controller.ts" region="use"}

The handler gets exactly what the combined decorators give it:

::example{file="controllers/slash/shop.slash.controller.spec.ts" region="spec"}

For a value any guard can read, make a typed metadata decorator with `createMetadata`, as
[Guards](/docs/4.1/guards) shows. `SetMetadata(key, value)` stores a value under a key of your choosing, read
with `ExecutionContext.get(key)`; prefer `createMetadata`, whose values are typed and whose key cannot collide.
`SetMetadata` refuses MeoCord's own keys, such as `'guards'`, where a value would replace what the framework
stores.
