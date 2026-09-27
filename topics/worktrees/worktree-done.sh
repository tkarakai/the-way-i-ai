#!/usr/bin/env bash
# worktree-done.sh — Clean up current worktree and return to main
#
# Usage: source this script via a shell function:
#   wwtd() { source /path/to/worktree-done.sh; }
#
# Summarizes the worktree state, then asks for confirmation before deleting.

# --- Help ---------------------------------------------------------------------

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<'HELP'
wwtd — clean up the current git worktree

Usage:
  wwtd          Summarize worktree state and offer to delete it

Run this from inside a worktree (not the main worktree). It will:
  1. Show uncommitted changes and unpushed commit status
  2. List gitignored files
  3. Detect running processes from this worktree directory
  4. Offer to kill lingering processes (separate confirmation)
  5. Offer to delete the worktree and its local branch

No options — just run it and follow the prompts.
HELP
  return 0 2>/dev/null || exit 0
fi

# Must be in a git repo
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "Error: not inside a git repository" >&2
  return 1 2>/dev/null || exit 1
fi

CURRENT_PATH="$(git rev-parse --show-toplevel)"
MAIN_PATH="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"

# Refuse to run from the main worktree
if [ "$CURRENT_PATH" = "$MAIN_PATH" ]; then
  echo "Error: already in the main worktree — nothing to clean up" >&2
  return 1 2>/dev/null || exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
FORCE=false

# --- Assess the situation ---------------------------------------------------

HAS_UNCOMMITTED=false
HAS_UNPUSHED=false
PUSHED_TO_REMOTE=false
COMMIT_COUNT=0

# Uncommitted changes?
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  HAS_UNCOMMITTED=true
fi

# Commits & push status?
if git rev-parse --verify "@{upstream}" &>/dev/null; then
  # Has upstream — check for unpushed
  UNPUSHED_LOG="$(git log @{upstream}..HEAD --oneline 2>/dev/null)"
  if [ -n "$UNPUSHED_LOG" ]; then
    HAS_UNPUSHED=true
    COMMIT_COUNT="$(echo "$UNPUSHED_LOG" | wc -l | tr -d ' ')"
  fi
  PUSHED_TO_REMOTE=true
else
  # No upstream — count commits since diverging from main
  MERGE_BASE="$(git merge-base HEAD main 2>/dev/null)"
  if [ -n "$MERGE_BASE" ]; then
    COMMIT_COUNT="$(git rev-list --count HEAD ^"$MERGE_BASE" 2>/dev/null)"
    if [ "$COMMIT_COUNT" -gt 0 ] 2>/dev/null; then
      HAS_UNPUSHED=true
    fi
  fi
fi

# --- Summarize and confirm --------------------------------------------------

echo ""
echo "Worktree: $CURRENT_PATH"
echo "Branch:   $BRANCH"
echo ""

if $HAS_UNCOMMITTED && $HAS_UNPUSHED; then
  echo "There are uncommitted changes and $COMMIT_COUNT unpushed commit(s)."
  echo "None of this work has been pushed to remote."
  FORCE=true
elif $HAS_UNCOMMITTED && $PUSHED_TO_REMOTE; then
  echo "All commits have been pushed to remote, but there are uncommitted changes."
  FORCE=true
elif $HAS_UNCOMMITTED; then
  echo "There are uncommitted changes. The branch was never pushed to remote."
  FORCE=true
elif $HAS_UNPUSHED && $PUSHED_TO_REMOTE; then
  echo "There are $COMMIT_COUNT unpushed commit(s) that haven't been pushed to remote."
  FORCE=true
elif $HAS_UNPUSHED; then
  echo "There are $COMMIT_COUNT commit(s) and the branch was never pushed to remote."
  FORCE=true
elif $PUSHED_TO_REMOTE; then
  echo "All work has been pushed to remote."
elif [ "$COMMIT_COUNT" -eq 0 ] 2>/dev/null; then
  echo "No commits were made in this worktree."
fi

# --- Gitignored files summary ------------------------------------------------

IGNORED_FILES="$(git ls-files --others --ignored --exclude-standard 2>/dev/null)"
if [ -n "$IGNORED_FILES" ]; then
  IGNORED_TOTAL="$(echo "$IGNORED_FILES" | wc -l | tr -d ' ')"

  # Group by top-level dir (or filename for root-level files), count, sort desc
  IGNORED_SUMMARY="$(echo "$IGNORED_FILES" | sed 's|/.*|/|' | sort | uniq -c | sort -rn)"

  echo "Gitignored files ($IGNORED_TOTAL total):"
  echo "$IGNORED_SUMMARY" | while read -r count name; do
    printf "  %-30s %s file(s)\n" "$name" "$count"
  done
  echo ""
fi

# --- Running processes from this worktree ------------------------------------

# Find processes whose command line references the worktree path
PROC_PIDS=""
PROC_DISPLAY=""
PROC_COUNT=0

while IFS= read -r pid; do
  [ -z "$pid" ] && continue
  # Skip our own shell and its parent
  [ "$pid" = "$$" ] && continue
  [ "$pid" = "$PPID" ] && continue
  PROC_PIDS="${PROC_PIDS} ${pid}"
  PROC_COUNT=$((PROC_COUNT + 1))
  # Get process details, replacing the worktree path with ./ for readability
  PROC_INFO="$(ps -p "$pid" -o pid=,comm=,args= 2>/dev/null | sed "s|$CURRENT_PATH/|./|g; s|$CURRENT_PATH|.|g")"
  if [ -n "$PROC_INFO" ]; then
    # Truncate long lines
    if [ ${#PROC_INFO} -gt 120 ]; then
      PROC_INFO="${PROC_INFO:0:117}..."
    fi
    PROC_DISPLAY="${PROC_DISPLAY}  ${PROC_INFO}\n"
  fi
done <<< "$(pgrep -f "$CURRENT_PATH" 2>/dev/null)"

if [ "$PROC_COUNT" -gt 0 ]; then
  echo "Running processes ($PROC_COUNT):"
  printf "$PROC_DISPLAY"
  echo ""
  printf "\033[1;33m>>> Kill $PROC_COUNT running process(es)? (y/N) \033[0m"
  read -r KILL_REPLY
  if [[ "$KILL_REPLY" =~ ^[Yy]$ ]]; then
    for pid in $PROC_PIDS; do
      kill "$pid" 2>/dev/null
    done
    # Brief wait, then force-kill any survivors
    sleep 1
    for pid in $PROC_PIDS; do
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    done
    echo "Killed $PROC_COUNT process(es)."
    echo ""
  fi
fi

echo ""
printf "\033[1;33m>>> Delete worktree and local branch? (y/N) \033[0m"
read -r REPLY
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  echo "Aborted. You can run 'wwtd' later to delete this worktree."
  return 0 2>/dev/null || exit 0
fi

# --- Clean up ----------------------------------------------------------------

cd "$MAIN_PATH" || { echo "Error: could not cd to $MAIN_PATH" >&2; return 1 2>/dev/null || exit 1; }

if $FORCE; then
  git worktree remove --force "$CURRENT_PATH"
else
  git worktree remove "$CURRENT_PATH"
fi

if [ $? -eq 0 ]; then
  echo "Removed worktree: $CURRENT_PATH"

  if [ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ] && [ "$BRANCH" != "main" ]; then
    git branch -D "$BRANCH" 2>/dev/null
    echo "Deleted local branch: $BRANCH"
  fi

  echo "Now in: $(pwd)"
else
  echo "Error: failed to remove worktree" >&2
  return 1 2>/dev/null || exit 1
fi
