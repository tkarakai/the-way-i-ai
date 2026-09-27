# AI-Aided Development Workflow

> **Note:** This document reflects the state of things as of early 2026. AI-assisted development tools are evolving at a breakneck pace — interfaces, capabilities, and trade-offs described here may be outdated by the time you read this.

A worktree-per-task workflow using VSCode, Claude Code, and git worktrees. Each task gets its own isolated branch, directory, and VSCode window.

## Claude Code Interface

As of early 2026, there are three ways to use Claude Code. This workflow uses the VSCode extension, but the others work too.

- **VSCode extension** — the sweet spot for this workflow. A single window gives you the code editor, terminal, git sidebar, and Claude Code side by side. No extra windows to manage.
- **CLI** — the most complete interface. All slash commands are available and new Claude Code features land here first. However, it does not manage worktrees on its own — you handle that with `wwt`/`wwtd`.
- **Claude Desktop App** — polished experience that handles worktrees automatically, but has limited Claude Code command support and its worktree cleanup doesn't match what `wwtd` provides.

## Setup

You need one "home base" — the main branch of your project, cloned and opened in VSCode. This window stays open throughout. It has:

- A code editor (for reading and manually editing code)
- A terminal (for creating/cleaning up worktrees)
- Git sidebar (for reviewing diffs and staging changes)
- Claude Code (for PR reviews)

Pull to get the latest before starting work.

## Working on a Task

### 1. Create a worktree

In the main branch terminal:

```bash
wwt -code fix the login bug
```

This creates a worktree, branches off main, and opens a new VSCode window in the worktree directory. You now have two VSCode windows — main and the worktree.

If you don't have a name in mind:

```bash
wwt -code
```

### 2. Do the work

In the **worktree VSCode window**, open Claude Code and describe what needs to be done. Claude Code works in the worktree's isolated branch.

During development you might start local processes (dev servers, databases, etc.) from the worktree terminal. All local tooling must be worktree-aware — servers need to bind to available ports instead of hardcoded defaults, so multiple worktrees can run simultaneously without port conflicts.

### 3. Ship it

When the work looks good, ask Claude Code in the worktree window:

> Commit, push, and open a PR.

### 4. Review the PR

Switch to the **main branch VSCode window**. In Claude Code:

> Review PR #123 and post comments.

### 5. Address review feedback

Switch back to the **worktree VSCode window**. Start a new Claude Code session:

> Read the PR comments, make the changes, commit, push, and respond to the comments.

### 6. Re-review

Switch to the **main branch VSCode window**. Start a new Claude Code session:

> Re-review PR #123 with the latest changes.

Repeat steps 5–6 until the PR is good.

### 7. Merge

Merge the PR on GitHub's web interface.

### 8. Clean up the worktree

In the **worktree VSCode window** terminal:

```bash
wwtd
```

This confirms all work is pushed, kills any dev processes started from the worktree directory, and deletes the worktree. The VSCode window becomes stale — just close it.

### 9. Update main

Back in the **main branch VSCode window** terminal, pull to get the merged code:

```bash
git pull
```

## Parallel Work

Multiple worktrees can be active at the same time. Each one has its own:

- VSCode window (with terminal + Claude Code)
- Git branch
- Working directory
- Running processes (dev servers, etc.)
- Browser windows (for testing)

The main challenge is window management — keeping track of which worktree needs human input, which is waiting on Claude Code, and which is done and ready for cleanup.

## Window Layout

At any point you might have open:

| Window | Purpose |
|--------|---------|
| VSCode — main branch | Home base. Create worktrees, review PRs, pull merged code. |
| VSCode — worktree A | Active task. Claude Code works here, dev server runs here. |
| VSCode — worktree B | Another task in parallel. |
| Browser — task A | Testing task A locally. |
| Browser — task B | Testing task B locally. |
| Browser — GitHub | Merging PRs. |
