# The Way I AI

A collection of related ideas about working with AI: practical workflows, useful mental models, and ways to organize AI systems in real life.

Each topic has authoritative source documents and assets, plus a complete, interactive HTML edition. Start with the [HTML contents page](index.html), or choose a topic below.

| Topic | Idea | Markdown | Interactive edition |
| --- | --- | --- | --- |
| **01 · Worktree-based development** | Give every development task its own branch, working directory, and AI session. | [Tools and setup](topics/worktrees/README.md) · [Workflow](topics/worktrees/WORKFLOW.md) | [Open HTML](topics/worktrees/index.html) |
| **02 · Defining AI agent roles** | Define agents through professional context, operational capabilities, and discoverable profiles. | [Framework](topics/agent-roles/README.md) | [Open HTML](topics/agent-roles/index.html) |

## Sources and presentation

This repository is a small static-site generator. Its source of truth is **Markdown + topic metadata + authored assets**. HTML is generated from those sources; it contains no independently maintained ideas.

```text
AGENTS.md                      Primary guide for maintaining content and presentation
CLAUDE.md                      Points to AGENTS.md
README.md                      Collection overview and build/publishing instructions
index.html                     Generated contents page
package.json                   Build commands and development dependencies
package-lock.json              Pinned dependency tree
topics/
  topics.json                  Collection copy and ordered list of topic IDs
  worktrees/
    README.md                  Tools, installation, and commands
    WORKFLOW.md                Development and review workflow
    topic.json                 Metadata, document order, and visual-guide bindings
    assets/                    Authored SVG diagrams and cover illustration
    worktree-new.sh             wwt tool
    worktree-done.sh            wwtd tool
    index.html                 Generated edition of both documents
  agent-roles/
    README.md                  Complete role framework, including named excerpts
    topic.json                 Metadata and visual-guide bindings
    assets/                    Authored SVG diagrams and cover illustration
    index.html                 Generated edition
design-system/                Shared visual language and generic reader components
scripts/                       Generator and contract checks
.github/workflows/pages.yml    GitHub Pages build and deployment
_site/                         Generated publication bundle (ignored by Git)
```

Diagrams are content: their SVG sources live with their topic, where their labels and relationships can be reviewed. Interactive panels reuse sections or named excerpts from Markdown. Short labels and bindings live in the topic's `topic.json`. Shared components arrange these sources without knowing which topic they represent.

## Reading locally

Download or clone the repository and open `index.html` in a modern browser. Every HTML file embeds its styles, scripts, fonts, diagrams, and complete text. An individual topic HTML file works offline when copied on its own. Navigating to other topics or opening source links requires the matching repository files.

GitHub's repository file viewer shows HTML source; GitHub Pages serves the interactive site. Both use the same generated pages and relative links.

## Editing and adding topics

Use Node.js 22 or newer for building. Node.js and npm are not needed for reading.

```sh
npm ci
npm run build
npm run check
npm test
```

`package.json` defines these commands and the build-only dependencies: Markdown parsing, code rendering, and fonts. `package-lock.json` makes installation reproducible.

To add a topic:

1. Create `topics/<id>/README.md` and a `topic.json` describing its title, introduction, and documents.
2. Add the folder ID to the `topics` array in `topics/topics.json`.
3. Add optional diagrams/images in `assets/`. Bind a visual explorer to Markdown sections or named excerpts when useful.
4. Run the commands above, inspect the generated pages, and update this README's topic list.

See [AGENTS.md](AGENTS.md) for the complete authoring contract, examples, and verification process. It applies to agents maintaining both the ideas and their presentation. See the [design system](design-system/README.md) for shared visual components.

Worktree installation paths changed when the topic moved. Existing shell functions should now source `topics/worktrees/worktree-new.sh` and `topics/worktrees/worktree-done.sh`; the topic's installation examples show the full commands.

## Previewing an in-progress branch

```sh
npm run preview
```

This builds the current checkout into `_site/` and serves it at the local URL printed in the terminal (normally `http://127.0.0.1:4173/`). If another worktree is using that port, the server chooses an available one. After editing, run `npm run build:site` in another terminal and refresh the browser. There is no separate preview content or theme.

Every pull request also produces a **site-preview-pr-N** artifact in its **Publish collection** workflow run. Follow the download link in the run summary, unzip the artifact, and open `index.html`. The artifact includes the complete offline site and source links, expires after 14 days, and does not change the public Pages site.

## GitHub Pages

GitHub Pages is the hosted edition of this same collection. The included workflow validates the checked-in HTML, runs generator tests, creates a clean `_site/` bundle, and deploys that bundle. It does not publish the repository root or build dependencies.

To prepare the publication bundle locally:

```sh
npm run build:site
```

This recreates `_site/` from the same sources and includes the topic files needed by source links. Open `_site/index.html` locally to inspect it.

To enable hosting after the changes reach GitHub:

1. In the repository's **Settings → Pages**, select **GitHub Actions** as the build/deployment source.
2. Merge the workflow and sources into `main`, or run the **Publish collection** workflow manually from `main`.
3. Use the deployment URL shown by the workflow. With GitHub's standard repository-site URL, this repository would be at `https://tkarakai.github.io/the-way-i-ai/`.

Pull requests run the same checks and build, without deployment. Pushes to `main` and manual runs from `main` deploy after checks pass. Preparing this repository does not itself enable hosting or publish the current branch.

Keep topic links relative, including the explicit `index.html` filenames, so the same files work under the repository's URL subpath, a custom domain, or `file://`.

Reference: [GitHub's custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
