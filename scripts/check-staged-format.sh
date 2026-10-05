#!/usr/bin/env bash
# Checks the formatting of the staged files Prettier formats, as CI's format:check does, before they are committed.
# What is checked is each file as staged, not as it stands in the working tree, with the repository's own Prettier.
# The pre-commit hook in .husky/ runs it.
set -o pipefail
prettier=./node_modules/.bin/prettier
if [ ! -x "$prettier" ]; then
  echo "Formatting: Prettier is not installed; run \`bun install\`." >&2
  exit 1
fi
unformatted=()
while IFS= read -r -d '' file; do
  # Only what Prettier formats and .prettierignore does not exclude
  info=$("$prettier" --file-info "$file")
  [[ $info == *'"ignored": true'* || $info == *'"inferredParser": null'* ]] && continue
  # Formatted and compared, as Prettier's --check on stdin passes a file it cannot parse
  git show ":$file" | "$prettier" --stdin-filepath "$file" | cmp -s - <(git show ":$file") \
    || unformatted+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACMR -z)
[ ${#unformatted[@]} -eq 0 ] && exit 0
printf 'Not formatted, or not parseable, as staged: %s\n' "${unformatted[@]}" >&2
echo "Formatting: run \`bun run format\`, then stage the files again." >&2
exit 1
