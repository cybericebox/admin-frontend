#!/usr/bin/env bash
# Tests of mise-tasks/worktree against a local bare repository as "origin" with faked mise and npm: scripts/worktree.test.sh
set -uo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd "$here/.." && pwd)
fail=0
check() { # name expected actual
  if [[ "$2" == "$3" ]]; then echo "ok   $1"; else echo "FAIL $1: want '$2', got '$3'"; fail=1; fi
}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
mkdir "$tmp/bin"
for tool in mise npm; do
  # shellcheck disable=SC2016 # $* and $PWD belong to the fake tool, not to this script
  printf '#!/usr/bin/env bash\necho "%s $* in $PWD" >>"$CALLS"\n' "$tool" >"$tmp/bin/$tool"
  chmod +x "$tmp/bin/$tool"
done
export PATH=$tmp/bin:$PATH CALLS=$tmp/calls
git init -q --bare "$tmp/origin.git"
git clone -q "$tmp/origin.git" "$tmp/w" 2>/dev/null
cd "$tmp/w" || exit 1
mkdir -p mise-tasks node_modules/next
cp "$repo/mise-tasks/worktree" mise-tasks/
printf '/node_modules/\n/.worktrees/\n' >.gitignore
git checkout -q -b develop && echo a >a && git add -A && git commit -qm init && git push -q origin develop
echo b >>a && git commit -qam local # a local commit that origin/develop does not have
export MISE_PROJECT_ROOT=$tmp/w
: >"$CALLS"

mise-tasks/worktree feat1 >/dev/null 2>&1
check "worktree created" "true" "$([[ -f .worktrees/feat1/a ]] && echo true || echo false)"
check "worktree branch" "feature/feat1" "$(git -C .worktrees/feat1 rev-parse --abbrev-ref HEAD)"
check "worktree base is the fresh origin/develop" "$(git rev-parse origin/develop)" "$(git -C .worktrees/feat1 rev-parse HEAD)"
check "node_modules is not copied" "false" "$([[ -e .worktrees/feat1/node_modules ]] && echo true || echo false)"
check "npm ci runs in the worktree" "1" "$(grep -cx "npm ci in $tmp/w/.worktrees/feat1" "$CALLS")"
check "the pinned tools are installed in the worktree" "1" "$(grep -cx "mise install in $tmp/w/.worktrees/feat1" "$CALLS")"

mise-tasks/worktree feat1 >/dev/null 2>&1
check "an existing name is refused" "1" "$?"
mise-tasks/worktree Bad/Name >/dev/null 2>&1
check "a malformed name is refused" "1" "$?"
mise-tasks/worktree >/dev/null 2>&1
check "a name is required" "1" "$?"

exit "$fail"
