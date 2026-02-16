# The Way I AI

Tools and workflows for AI-aided software development.

## Repo Structure

```
worktrees/
  worktree-new.sh   — create a worktree, launch Claude or VSCode
  worktree-done.sh  — summarize state, clean up worktree
README.md           — user-facing docs (installation, usage)
```

## Design Decisions

- Scripts use `source` (not subshell) so `cd` affects the caller's shell
- `return 1 2>/dev/null || exit 1` pattern handles both sourced and direct execution
- Worktrees go under `~/.worktrees/<project-name>/`
- Branch naming: `claude/<worktree-name>`
- A per-project counter file at `~/.worktrees/<project-name>/.counter` ensures unique prefixes (001–999)
- Process detection uses `pgrep -f` matching the worktree path
- Gitignored file summary uses portable `sed | sort | uniq -c` (no bash 4+ associative arrays — must work when sourced in zsh)
- The done script has a separate kill confirmation before the delete confirmation
- `worktree-new.sh` resolves `worktree-done.sh` relative to its own location via `BASH_SOURCE`, so both scripts just need to be in the same directory
