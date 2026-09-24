---
id: configuration
title: "Configuration"
order: 5
source: readme@4.0.0
---

### `meocord.config.ts`

The top-level config file. At minimum it needs `discordToken`. The `rsbuild` hook lets you adjust the build without ejecting.

```typescript
import { type MeoCordConfig } from 'meocord/interface'

export default {
  appName: 'MyBot',
  discordToken: process.env.TOKEN!,
  rsbuild: config => {
    // Import .md and .html files as their text.
    config.tools ??= {}
    config.tools.rspack = (_rspackConfig, { addRules }) => {
      addRules([{ test: /\.(md|html)$/i, type: 'asset/source' }])
    }
    return config
  },
} satisfies MeoCordConfig
```

MeoCord builds with [Rsbuild](https://rsbuild.rs). The hook receives its configuration and returns it, modified. A few things it handles for you, so you do not need rules for them:

- **Images, fonts, svg and media** are emitted to `dist/assets/`, and importing one gives you its absolute path on disk — ready for `fs`, canvas, or a Discord attachment. Nothing is ever inlined as a data URI, whatever its size.
- **Custom asset paths** — `output.filename.image` (and `svg`, `font`, `media`) accept a function, for when two files share a name in different folders:

  ```typescript
  import path from 'node:path'

  // ...
  rsbuild: config => {
    config.output ??= {}
    config.output.filename = {
      ...config.output.filename,
      // Keep the folder a file came from, so image/star.webp and image/hsr/star.webp do not collide.
      // The result is relative to dist/assets/, and uses / on every platform.
      image: ({ filename }) => path.relative('src/assets', filename ?? '').split(path.sep).join('/'),
    }
    return config
  },
  ```

- **Raw bundler rules** go through `tools.rspack`, which takes a webpack-shaped configuration.

| Option               | Default | Description                                                                                            |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `discordToken`       | —       | The bot token. Read it from the environment rather than writing it here.                               |
| `appName`            | —       | Shown in log lines.                                                                                    |
| `rsbuild`            | —       | `(config) => config` — adjust the Rsbuild configuration.                                               |
| `bundleDependencies` | `false` | Put everything the bot needs inside `dist`, native addons included, so it runs without `node_modules`. |
| `externals`          | `[]`    | Modules to keep out of the bundle. Native addons are found without being listed.                       |

See [Self-contained builds](/docs/4.0/deployment#self-contained-builds) for when to turn on `bundleDependencies`.

### ESLint

MeoCord exports a base ESLint config from `meocord/eslint`. It lints your TypeScript, `meocord.config.ts`
included, with type information from `tsconfig.json`, `tsconfig.test.json` and `tsconfig.eslint.json`; a
file ESLint reports as not included in any of them needs listing in one. Extend it as needed:

```javascript
import meocordEslint, { typescriptConfig } from 'meocord/eslint'
import unusedImports from 'eslint-plugin-unused-imports'

export default [
  ...meocordEslint,
  {
    ...typescriptConfig,
    plugins: {
      ...typescriptConfig.plugins,
      'unused-imports': unusedImports,
    },
    rules: {
      ...typescriptConfig.rules,
      'unused-imports/no-unused-imports': 'error',
    },
  },
]
```

---
