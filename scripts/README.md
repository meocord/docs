# Content pipeline

Everything the site shows about a MeoCord version comes from the package published to npm, checked
before anything is generated from it, or from files written for the site and checked against the
exact version they describe.

## What lives where

| Path                                   | Contents                                                                             | Edited by           |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ------------------- |
| `versions.json`                        | The documented versions, grouped into minor lines with a status each, and provenance | the sync, reviewers |
| `content/<line>/`                      | A line's authored guides: one Markdown page each, with `id` and `title` front matter | people              |
| `generated/readme/<line>/`             | A line's guides imported from the README its newest version shipped                  | the pipeline only   |
| `examples/<line>/`                     | A workspace pinning that line's exact meocord; guides embed its files                | people              |
| `generated/api/<version>.json`         | TypeDoc's JSON for the version's declaration files, one module per entry point       | the pipeline only   |
| `generated/changelog/<version>.json`   | The version's CHANGELOG.md section, split into entries, each marked if breaking      | the pipeline only   |
| `generated/migrating/<line>.md`        | `docs/MIGRATING.md` at the commit the line's newest version was built from           | the pipeline only   |
| `generated/readme-anchors/<line>.json` | For a line whose guides are imported from its README: which page holds each heading  | the pipeline only   |
| `generated/config/<version>.json`      | The version's `meocord.config.ts` options, read from its API document and since.json | the pipeline only   |
| `generated/since.json`                 | The first version every symbol, member and parameter appears in, from the API diffs  | the pipeline only   |

A line's status is `prerelease`, `current`, `maintained` or `archived`. `latest` is the current line and
`next` the one in prerelease. A line's `guides` decides what the site shows for it: `readme`, the pages in
`generated/readme/<line>/` imported from the README its newest version shipped, or `authored`, the pages in
`content/<line>/`. Authored pages can land in `content/<line>/` while the line is still `readme`; the site
shows them once a pull request switches the line to `authored` and deletes its `generated/readme/<line>/`.
The pipeline never changes a file under `content/`; it only starts a new line's folder from the newest
line's authored guides.

Content stores links by line, `/docs/4.1/guards`, never through `latest` or `next`, in the form
`src/lib/urls.ts` builds; the site maps them to the URLs it emits. `scripts/lib/pages.ts` is how the site
reads a line's pages and the code an `::example` embeds. An authored line also shows `config-reference`, a
page built from its newest version's `generated/config/<version>.json`; `content:check` refuses a
hand-written page with that slug.

## Verifying a version

Before anything is generated from a version, the pipeline:

1. downloads its tarball and compares its sha512 with the registry's `dist.integrity`;
2. fetches the registry's SLSA provenance attestation and verifies its Sigstore signature against
   Sigstore's trusted root, requiring the issuer `https://token.actions.githubusercontent.com` and the
   exact identity `versions.json` names for that version's range;
3. checks that the attested subject is `pkg:npm/meocord@<version>` with the downloaded tarball's sha512.

Versions up to 4.0.x were published from `l7aromeo/meocord`, and from 4.1.0-beta.0 on from
`meocord/meocord`; both identities are listed exactly. A version with no attestation fails, unless its
exact version is listed under `provenance.integrityOnly`, which a reviewer adds on purpose.

## Commands

| Command                                      | What it does                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `bun run versions:sync`                      | Adds each published version the site lacks, verified, and updates `bun.lock` for its example pin      |
| `bun run api:generate <version...>`          | Regenerates what the site takes from listed versions, verified again; `--all` after a TypeDoc upgrade |
| `bun run content:check`                      | Checks front matter, examples, links and anchors, and that every version has its generated data       |
| `bun run examples:check [line...]`           | Typechecks each line's examples against its pinned meocord                                            |
| `bun run content:backport <sha> --to <line>` | Applies a commit's change to one line's guides to another line, on a branch of its own                |

`bunfig.toml` sets Bun's isolated linker, so each example workspace resolves its own meocord. The pipeline's
tests run offline with the rest of the repository's, in `bun run test:coverage`.

Guides embed examples with `::example{file="guards/owner.guard.ts" region="guard"}`, a path under
`examples/<line>/src/` and a region between `// #region guard` and `// #endregion guard`. A written guide
has no TypeScript code fence: its TypeScript is in an example, where it is typechecked. Pages imported
from a README keep the README's code blocks as they were published.

## The release bot

`.github/workflows/sync-versions.yml` runs `versions:sync` hourly and on demand, and opens a pull request
with what it added. It opens the pull request as a GitHub App, because one opened with the workflow's own
token would not run the checks. The maintainer sets up:

1. A GitHub App owned by the `meocord` organization, installed on `meocord/docs` only, with the
   repository permissions **Contents: Read and write** and **Pull requests: Read and write** and nothing
   else. No webhook.
2. An environment named `docs-bot` in `meocord/docs`, with deployment branches limited to `main`,
   holding the variable `DOCS_BOT_CLIENT_ID` (the app's client ID) and the secret `DOCS_BOT_PRIVATE_KEY`
   (a private key generated for the app).

The workflow mints a token that lasts an hour, and only after the sync has run, so nothing the sync
downloads runs while the token exists. The app can push branches and open pull requests in this
repository, and nothing more: it is in no branch-protection bypass list. Revoke its key in the app's
settings if it leaks.
