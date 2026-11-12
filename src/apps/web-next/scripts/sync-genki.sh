#!/bin/sh
# Refreshes vendor/genki: genki's four frontend packages as source, at one commit.
#
#   scripts/sync-genki.sh <genki checkout> <commit or ref> [<branch, when not main>]
#
# What is copied: packages/{client,i18n,ui-blocks,ui-assembly}/package.json and src/, without
# tests, test utilities and fixtures, and genki's LICENSE. The copy is byte for byte what the
# commit holds, and GENKI_COMMIT records which commit that is. Never edit vendor/ by hand: a fix
# goes to genki as a pull request and comes back through this script.
set -eu

if [ $# -lt 2 ]; then
  echo "usage: $0 <genki checkout> <commit or ref> [<branch, when not main>]" >&2
  exit 2
fi

checkout=$1
ref=$2
branch=${3:-main}
here=$(cd "$(dirname "$0")/.." && pwd)
target="$here/vendor/genki"
packages="client i18n ui-blocks ui-assembly"

sha=$(git -C "$checkout" rev-parse --verify "$ref^{commit}")
date=$(git -C "$checkout" show -s --format=%cI "$sha")

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

paths="LICENSE"
for p in $packages; do paths="$paths packages/$p/package.json packages/$p/src"; done
# shellcheck disable=SC2086
git -C "$checkout" archive --format=tar "$sha" $paths | tar -x -C "$work"

# Tests and what only tests use are left out.
find "$work/packages" \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*test-utils*' \
  -o -name 'contract-suite.ts' \) -type f -delete
find "$work/packages" -type d -name fixtures -prune -exec rm -rf {} +

rm -rf "$target"
mkdir -p "$target"
for p in $packages; do mv "$work/packages/$p" "$target/$p"; done
mv "$work/LICENSE" "$target/LICENSE"
cat > "$target/GENKI_COMMIT" <<RECORD
commit: $sha
date: $date
branch: $branch
source: https://github.com/digdir/genki/tree/$sha
RECORD

count=$(find "$target" -type f | wc -l | tr -d ' ')
echo "vendor/genki: $count files from digdir/genki $sha ($branch, $date)"
