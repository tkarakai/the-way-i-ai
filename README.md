# the-way-i-ai

Tools and workflows for AI-aided software development on macOS.

## Git Worktrees for Claude Code

A worktree-per-task workflow that gives each Claude Code session its own isolated branch and working directory. Start a task, let Claude work, clean up when done.

### How it works

1. **`wwt`** creates a fresh git worktree with a Docker-style random name (e.g. `038-upbeat-rosalind`), branches off your current HEAD, cd's into it, and launches Claude Code. When Claude exits, it automatically runs `wwtd` to offer cleanup.

2. **`wwtd`** (done) summarizes the worktree state — uncommitted changes, unpushed commits, gitignored files, running processes — then offers to kill lingering processes and delete the worktree.

```
$ wwt

✦ 038-upbeat-rosalind
  Worktree: ~/.worktrees/my-project/038-upbeat-rosalind
  Branch:   claude/038-upbeat-rosalind
  Now in: ~/.worktrees/my-project/038-upbeat-rosalind
  Launching claude...

  # ... Claude does its thing ...

  Claude exited. Cleaning up worktree...
  All work has been pushed to remote.
  >>> Delete worktree and local branch? (y/N)
```

### Why worktrees?

- **Isolation** — each task gets its own branch and directory. No stashing, no juggling.
- **Parallel work** — run multiple Claude sessions on different tasks in the same repo, simultaneously.
- **Safe cleanup** — the done script warns you about uncommitted changes and unpushed commits before deleting anything.
- **Clean main** — your main worktree stays untouched.

### Requirements

- macOS (tested on Apple Silicon and Intel Macs)
- Git

### Installation

Clone this repo and add two shell functions to your `~/.zshrc`:

```bash
# Point these at wherever you cloned the repo
wwt()  { source ~/path/to/the-way-i-ai/worktrees/worktree-new.sh "$@"; }
wwtd() { source ~/path/to/the-way-i-ai/worktrees/worktree-done.sh; }
```

Then reload your shell:

```bash
source ~/.zshrc
```

The scripts must be **sourced** (not executed) so they can `cd` your shell into the worktree directory.

### Usage

| Command | What it does |
|---------|-------------|
| `wwt` | Create worktree, cd into it, launch Claude Code. Runs `wwtd` on exit. |
| `wwt -code` | Create worktree, cd into it, open VSCode. Run `wwtd` manually later. |
| `wwtd` | Summarize and clean up the current worktree. |

Run `wwt` from any git repo. The worktree is created under `~/.worktrees/<project-name>/`.

### Details

- **Naming**: each worktree gets a sequential 3-digit prefix and a random `adjective-surname` combo (e.g. `012-serene-dijkstra`). A per-project counter at `~/.worktrees/<project-name>/.counter` ensures uniqueness.
- **Branches**: created as `claude/<worktree-name>` so they're easy to spot and filter.
- **Cleanup checks**: before deleting, `wwtd` reports uncommitted changes, unpushed commits, gitignored file counts, and any processes still running from that directory. Processes get their own kill confirmation before the delete confirmation.
- **Shell compatibility**: works in both bash and zsh. Avoids bash 4+ features (no associative arrays) so it runs correctly when sourced in macOS's default zsh.
