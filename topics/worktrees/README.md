---
category: Software development
description: >-
  One task. One branch. One working directory. A practical workflow for building
  with Claude Code, reviewing changes, and working in parallel.
thesis: Give every task its own space.
cover: assets/cover.svg
documents:
  - README.md
  - WORKFLOW.md
explorer:
  title: From a fresh task to a clean main.
  instruction: Nine steps. Select a step to follow the workflow.
  diagram: assets/diagram.svg
  caption: Each task gets an isolated branch and directory.
  controls: numbered
  panels:
    - id: create
      source: { document: WORKFLOW.md, heading: 1. Create a worktree }
      highlight: [workflow-create]
    - id: work
      source: { document: WORKFLOW.md, heading: 2. Do the work }
      highlight: [workflow-work]
    - id: ship
      source: { document: WORKFLOW.md, heading: 3. Ship it }
      highlight: [workflow-work]
    - id: review
      source: { document: WORKFLOW.md, heading: 4. Review the PR }
      highlight: [workflow-review]
    - id: revise
      source: { document: WORKFLOW.md, heading: 5. Address review feedback }
      highlight: [workflow-review]
    - id: rereview
      source: { document: WORKFLOW.md, heading: 6. Re-review }
      highlight: [workflow-review]
    - id: merge
      source: { document: WORKFLOW.md, heading: 7. Merge }
      highlight: [workflow-merge]
    - id: cleanup
      source: { document: WORKFLOW.md, heading: 8. Clean up the worktree }
      highlight: [workflow-clean]
    - id: pull
      source: { document: WORKFLOW.md, heading: 9. Update main }
      highlight: [workflow-pull]
---

# Git Worktrees for Claude Code

## Introduction

Tools and workflows for AI-aided software development on macOS.

## Overview

A worktree-per-task workflow that gives each Claude Code session its own isolated branch and working directory. Start a task, let Claude work, clean up when done.

### How it works

1. **`wwt`** creates a fresh git worktree with a Docker-style random name (e.g. `038-upbeat-rosalind`), branches off your current HEAD, cd's into it, and launches Claude Code. When Claude exits, it automatically runs `wwtd` to offer cleanup.

2. **`wwtd`** (done) summarizes the worktree state — uncommitted changes, unpushed commits, gitignored files, running processes — then offers to kill lingering processes and delete the worktree.

```
$ wwt

✦ 038-upbeat-rosalind
  Worktree: ~/.worktrees/my-project/038-upbeat-rosalind
  Branch:   038-upbeat-rosalind
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
wwt()  { source ~/path/to/the-way-i-ai/topics/worktrees/worktree-new.sh "$@"; }
wwtd() { source ~/path/to/the-way-i-ai/topics/worktrees/worktree-done.sh; }
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
| `wwt fix the login bug` | Same, but names the worktree `012-fix-the-login-bug` instead of a random name. |
| `wwt -code` | Create worktree, cd into it, open VSCode. Run `wwtd` manually later. |
| `wwt -code fix login` | Combine both — custom name + VSCode. |
| `wwtd` | Summarize and clean up the current worktree. |

Run `wwt` from any git repo. The worktree is created under `~/.worktrees/<project-name>/`.

Custom names are sanitized automatically: lowercased, spaces and special characters become hyphens, truncated to 50 characters.

### Managing worktrees with `gwt`

If you use oh-my-zsh, `gwt` is a built-in alias for `git worktree`. Useful commands:

```bash
gwtls                    # list all worktrees
gwt list                 # same thing

cd $(gwt list | grep 012 | awk '{print $1}')
                         # jump into worktree 012

gwtrm ~/.worktrees/my-project/012-fix-login-bug
                         # remove a worktree (fails if dirty)

gwtrm --force ~/.worktrees/my-project/012-fix-login-bug
                         # force-remove even with uncommitted changes
```

If you don't use oh-my-zsh, you can add the aliases yourself:

```bash
alias gwt='git worktree'
alias gwtls='git worktree list'
alias gwtrm='git worktree remove'
```

### Details

- **Naming**: each worktree gets a sequential 3-digit prefix and a random `adjective-surname` combo (e.g. `012-serene-dijkstra`). A per-project counter at `~/.worktrees/<project-name>/.counter` ensures uniqueness.
- **Branches**: the branch name matches the worktree name (e.g. `012-serene-dijkstra`). The 3-digit prefix makes them easy to spot and filter.
- **Cleanup checks**: before deleting, `wwtd` reports uncommitted changes, unpushed commits, gitignored file counts, and any processes still running from that directory. Processes get their own kill confirmation before the delete confirmation.
- **Shell compatibility**: works in both bash and zsh. Avoids bash 4+ features (no associative arrays) so it runs correctly when sourced in macOS's default zsh.
