# AGENTS.md

Operating guide for AI agents working on the MeoCord documentation site. Read it before your first change.

This file changes only with the maintainer's approval: do not edit it; propose changes instead. Keep it short — link
to the code or the README rather than copying into it.

## 0. Agent setup

`AGENTS.md` is the only agent instruction file in this repository. A tool that reads a different file links it
locally (`ln -s AGENTS.md CLAUDE.md`); the link and tool directories such as `.claude/` are ignored by git.

**AI use.** Using AI tools here is allowed. The person who submits a change is its author and is responsible for it,
exactly as for code written by hand. Changes carry only that person's authorship.

## 1. Project at a glance

| Item    | Value                                                                          |
| ------- | ------------------------------------------------------------------------------ |
| Site    | meocord.meoverse.com; repository `meocord/docs`, default branch `main`         |
| Stack   | Next.js 16 (App Router, Cache Components), `@meonode/ui` with no JSX           |
| Runtime | Bun everywhere: install, scripts, tests, CI and the container image            |
| Tests   | Vitest with Istanbul coverage (thresholds enforced), Playwright smoke tests    |
| Deploy  | Pushes to `main` publish `ghcr.io/meocord/docs`; the server pulls and verifies |

Commands are in the [README](README.md#development). Before writing Next.js code, read the guide for your version in
`node_modules/next/dist/docs/`; APIs differ from older releases.

## 2. Rules that are easy to break

- **No JSX.** Components are `@meonode/ui` node functions and follow its
  [rules and patterns](https://ui.meonode.com/docs/getting-started/rules-and-patterns): only the top level calls
  `.render()`, hook components are `Component(function Name…)` and conditional ones go through `Node()`, lists use
  `For`, `as` takes only intrinsic tags, and props that collide with CSS go under `props`.
- **Cache and security headers live in `src/proxy.ts`.** A response through the proxy is dynamic to Next, so
  `headers()` in `next.config.ts` covers only paths the proxy does not match. Route handlers outside the matcher set
  their own.
- **`generated/` is written only by the content pipeline** (`scripts/`); never edit it by hand. A change there comes
  from re-running the pipeline.
- **Never pass `css` at the call site of a prestyled factory.** `createNode` merges shallowly, so a call-site `css`
  replaces the factory's, fallbacks included ([meonode#31](https://github.com/l7aromeo/meonode/issues/31)). Override
  with CSS props, or make the piece a function that composes `Div()` and merges `css`.
- **Pages are identical for every reader.** No cookies, no per-request reads, no nonce. Client state (theme and
  similar) is stamped by the pre-paint script, and page content has no Suspense holes.
- **`SITE_INDEXABLE` is the only indexing switch**, read at build. Every new surface honours it; the smoke tests assert
  it.
- **Bun only.** If something fails under Bun, report it with its output; never fall back to Node silently.
- **Dependencies** stay on their latest stable versions, except `typescript`, held at exactly 6.0.3.
- **No infrastructure detail.** This repository is public: it names no host, address, network or server
  configuration beyond the public site URL and `ghcr.io`.
- **Comments** describe the code as it is now, in one line where one line carries it. No history.

## 3. Git and pull requests

- Branch from up-to-date `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`. Conventional commit subjects, with a body
  saying what was wrong, what changed and how it was verified.
- Before a PR: `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test:coverage`, and
  `bun run build && bun run test:e2e`.
- Never push to `main`, never merge your own PR, and never run the publish job by hand.

### No AI residue

The repository holds only what the project maintains. Plans, specs, design notes, task lists, prompts, reports and
tool output stay in a scratch directory outside it. The lasting record of a change is its commit message and PR.

### Keep coordination out of the project

Code, comments, commits, branch names, PRs and issue comments never mention agents, sessions or their roles, task
assignments or hand-offs, how a change was arrived at beyond what a reviewer needs, or AI tools and models, including
attribution lines such as `Co-Authored-By`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
