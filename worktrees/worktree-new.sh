#!/usr/bin/env bash
# worktree-new.sh — Create a git worktree with a random Docker-style name
#
# Usage: source this script via a shell function:
#   wwt() { source /path/to/worktree-new.sh "$@"; }
#
# wwt                    — create worktree, cd into it, launch claude, then wwtd on exit
# wwt fix the login bug  — same, but use "fix-the-login-bug" as the name
# wwt -code              — create worktree, cd into it, open VSCode (no auto-cleanup)
# wwt -code fix login    — combine both

# --- Word lists (100 each) ---------------------------------------------------

ADJECTIVES=(
  admiring agile ambitious amiable astute
  blazing bold brave bright brilliant
  calm charming cheerful clever competent
  daring dazzling decisive determined devoted
  eager earnest ecstatic effervescent elegant
  festive fierce flamboyant focused fortunate
  gallant generous gentle gifted gleaming
  graceful grateful gritty hardy heroic
  hopeful humble industrious ingenious inspiring
  inventive jolly jovial keen kind
  lively logical lucid luminous majestic
  mellow modest mystical nimble noble
  nifty objective observant optimistic orderly
  patient peaceful perceptive playful plucky
  pragmatic proud quirky radiant refined
  relaxed resilient reverent robust romantic
  sage savvy serene sharp shrewd
  sincere sleek spirited steadfast stoic
  sublime subtle swift tender thoughtful
  tranquil trusting upbeat valiant vibrant
  vigilant vivid warm whimsical willing
  wise witty wonderful zealous zen
)

SURNAMES=(
  archimedes babbage bell bernoulli bohr
  boltzmann boole brahe carmack cerf
  chomsky church copernicus curie curry
  darwin dijkstra dirac einstein euler
  faraday fermat fermi feynman fibonacci
  galileo gauss godel goldberg gosling
  hawking heisenberg hilbert hopper huygens
  jacquard johnson joy kahn karp
  kepler kernighan knuth lamport laplace
  leibniz liskov lovelace mandelbrot maxwell
  mccarthy mendel minsky morse nash
  neumann newton nightingale noether nyquist
  ohm pascal pasteur pauling penrose
  perlis planck poincare poisson ramanujan
  riemann ritchie rosalind rubin sagan
  schrodinger shannon shamir stallman stroustrup
  swartz tesla thompson torvalds turing
  visvesvaraya volta watt wiles wozniak
)

# --- Help ---------------------------------------------------------------------

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<'HELP'
wwt — create a git worktree for a Claude Code (or VSCode) session

Usage:
  wwt                       Create worktree with a random name, launch Claude
  wwt fix the login bug     Create worktree named "012-fix-the-login-bug"
  wwt -code                 Create worktree with a random name, open VSCode
  wwt -code fix login       Create worktree named "012-fix-login", open VSCode

Options:
  -code       Open VSCode instead of Claude Code (no auto-cleanup on exit)
  -h, --help  Show this help

The worktree is created under ~/.worktrees/<project>/ with a unique 3-digit
prefix. Custom names are lowercased, special characters become hyphens, and
the name is truncated to 50 characters.

When launched without -code, the done script (wwtd) runs automatically after
Claude exits to offer cleanup.
HELP
  return 0 2>/dev/null || exit 0
fi

# --- Parse arguments ----------------------------------------------------------

_WWT_MODE="claude"
_WWT_CUSTOM_NAME=""

_WWT_ARGS=()
for _wwt_arg in "$@"; do
  if [ "$_wwt_arg" = "-code" ]; then
    _WWT_MODE="code"
  else
    _WWT_ARGS+=("$_wwt_arg")
  fi
done

if [ ${#_WWT_ARGS[@]} -gt 0 ]; then
  # Join all non-flag args, lowercase, replace non-alphanumeric runs with "-",
  # strip leading/trailing "-", truncate to 50 chars
  _WWT_CUSTOM_NAME="$(printf '%s ' "${_WWT_ARGS[@]}" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//' \
    | cut -c1-50)"
fi

# --- Main logic ---------------------------------------------------------------

# Must be in a git repo
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "Error: not inside a git repository" >&2
  return 1 2>/dev/null || exit 1
fi

PROJECT="$(basename "$(git rev-parse --show-toplevel)")"
WORKTREE_BASE="$HOME/.worktrees/$PROJECT"

# Collect existing worktree directory names for collision detection
EXISTING=()
if [ -d "$WORKTREE_BASE" ]; then
  while IFS= read -r d; do
    [ -n "$d" ] && EXISTING+=("$(basename "$d")")
  done <<< "$(find "$WORKTREE_BASE" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)"
fi

# Read and increment the per-project counter (1–999, resets after 999)
mkdir -p "$WORKTREE_BASE"
COUNTER_FILE="$WORKTREE_BASE/.counter"
if [ -f "$COUNTER_FILE" ]; then
  COUNTER="$(cat "$COUNTER_FILE")"
else
  COUNTER=0
fi
COUNTER=$(( (COUNTER % 999) + 1 ))
echo "$COUNTER" > "$COUNTER_FILE"
NUM=$(printf "%03d" "$COUNTER")

# Generate the worktree name
if [ -n "$_WWT_CUSTOM_NAME" ]; then
  # Custom name: prefix with counter
  NAME="$NUM-$_WWT_CUSTOM_NAME"
else
  # Random Docker-style name (up to 10 attempts to avoid collision)
  NAME=""
  for attempt in $(seq 1 10); do
    ADJ="${ADJECTIVES[$((RANDOM % ${#ADJECTIVES[@]}))]}"
    SUR="${SURNAMES[$((RANDOM % ${#SURNAMES[@]}))]}"
    CANDIDATE="$NUM-$ADJ-$SUR"

    COLLISION=false
    for existing in "${EXISTING[@]}"; do
      if [ "$existing" = "$CANDIDATE" ]; then
        COLLISION=true
        break
      fi
    done

    if [ "$COLLISION" = false ]; then
      NAME="$CANDIDATE"
      break
    fi
  done
fi

if [ -z "$NAME" ]; then
  echo "Error: could not generate a unique name after 10 attempts" >&2
  return 1 2>/dev/null || exit 1
fi

WORKTREE_PATH="$WORKTREE_BASE/$NAME"
BRANCH="$NAME"

echo ""
echo -e "\033[1;36m✦ $NAME\033[0m"
echo "  Worktree: $WORKTREE_PATH"
echo "  Branch:   $BRANCH"

if ! git worktree add "$WORKTREE_PATH" -b "$BRANCH"; then
  echo "Error: git worktree add failed" >&2
  return 1 2>/dev/null || exit 1
fi

cd "$WORKTREE_PATH" || return 1 2>/dev/null || exit 1
echo "Now in: $(pwd)"

# Resolve the done script relative to this script's location
_TWIAI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

if [ "$_WWT_MODE" = "code" ]; then
  echo "Opening VSCode..."
  code .
  echo "Run 'wwtd' when you're done to clean up this worktree."
else
  echo "Launching claude..."
  claude

  # After claude exits, offer to clean up
  echo ""
  echo "Claude exited. Cleaning up worktree..."
  source "$_TWIAI_SCRIPT_DIR/worktree-done.sh"
fi
