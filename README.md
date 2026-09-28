**[Read the interactive site →](https://thewayiai.com/)**

# The Way I AI

A collection of related ideas about working with AI: practical workflows, useful mental models, and ways to organize AI systems in real life.

Each topic has authoritative source documents and assets, plus a complete, interactive HTML edition. Start with the [live collection](https://thewayiai.com/), or choose a topic below.

| Topic | Idea | Markdown | Interactive edition |
| --- | --- | --- | --- |
| **01 · Worktree-based development** | Give every development task its own branch, working directory, and AI session. | [Tools and setup](topics/worktrees/README.md) · [Workflow](topics/worktrees/WORKFLOW.md) | [Read online](https://thewayiai.com/topics/worktrees/index.html) |
| **02 · Defining AI agent roles** | Define agents through professional context, operational capabilities, and discoverable profiles. | [Framework](topics/agent-roles/README.md) | [Read online](https://thewayiai.com/topics/agent-roles/index.html) |
| **03 · A web app starter kit built for the long run** | Architect the starter to stay useful when downstream applications replace its design, without making future improvements undo their product choices. | [The architecture](topics/web-app-starter-kit/README.md) · [Original notes](topics/web-app-starter-kit/web_app_starter_upgrade_notes.md) | [Read online](https://thewayiai.com/topics/web-app-starter-kit/index.html) |

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
  web-app-starter-kit/
    README.md                  Starter architecture for long-lived downstream applications
    web_app_starter_upgrade_notes.md  Original notes, preserved unchanged
    topic.json                 Metadata and visual-guide bindings
    assets/                    Architecture diagram and replaceable-UI cover illustration
    index.html                 Generated edition of the complete article
design-system/                Shared visual language and generic reader components
scripts/                       Generator and contract checks
.github/workflows/pages.yml    GitHub Pages build and deployment
_site/                         Generated publication bundle (ignored by Git)
```

Diagrams are content: their SVG sources live with their topic, where their labels and relationships can be reviewed. Interactive panels reuse sections or named excerpts from Markdown. Short labels and bindings live in the topic's `topic.json`. Shared components arrange these sources without knowing which topic they represent.

## Reading locally

Download or clone the repository and open `index.html` in a modern browser. Every HTML file embeds its styles, scripts, fonts, diagrams, and complete text. Cards, contents links, and next-topic links use relative paths with explicit `index.html` filenames, so navigation works through `file://` when the folder structure is kept intact. An individual topic HTML file also works offline when copied on its own, but links to other pages need those files alongside it in their original locations.

GitHub's repository file viewer shows HTML source; the [live site](https://thewayiai.com/) serves the interactive edition. Documentation links lead to that live site, while navigation inside the generated HTML stays relative for both hosted and local reading. The rendered pages contain no links to raw Markdown; source documents remain available in the repository.

The Folio edition includes local collection-wide search (⌘/Ctrl+K), section search (`/`), an expandable collection sidebar, and optional visual guides. Topic pages start with the sidebar collapsed and compact the header while you scroll. Use “Focus on reading” to hide navigation beside the article, then “Show navigation” to restore it. The icon next to GitHub switches directly to the opposite theme: a moon for Dark, a sun for Light. System is the default and follows device changes; a manual choice resets to System after two hours without scrolling, typing, or navigation. All text is readable without JavaScript.

## Editing and adding topics

Use Node.js 24 or newer for building. Node.js and npm are not needed for reading.

```sh
npm ci
npm run typecheck
npm run build
npm run check
npm test
```

For browser acceptance tests (also run before deployment):

```sh
npx playwright install chromium
npm run test:browser
```

These tests build `_site/` and exercise standalone offline pages, narrow layouts, keyboard controls, themes, sidebar behavior, and header scrolling. Screenshots and failure traces are written to the ignored `test-results/` directory.

`package.json` defines these commands and the development-only dependencies: TypeScript checking/compilation, Markdown parsing, code rendering, fonts, and Playwright tests. `package-lock.json` makes installation reproducible.

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

This builds the current checkout into `_site/` and serves it at the local URL printed in the terminal (normally `http://127.0.0.1:4173/`). If another worktree is using that port, the server chooses an available one. After editing, run `npm run build:site` in another terminal and refresh the browser. This full-site preview uses the publication content and theme.

For the standalone title color study, open `previews/title-colors.html` locally. Its color controls affect only the study, not the site's theme. Regenerate it with `node previews/build-title-colors.ts` after `npm run build`. The study stays in the repository and is excluded from the publication bundle.

For the draggable wave editor, open `previews/title-wave-editor.html`; regenerate it with `node previews/build-title-wave-editor.ts`. Its four corners are measured in title-relative em units. Save an approved export to `topics/assets/title-wave-position.json` and rebuild to apply it to the collection title and every miniature header wordmark. The static comparison pages can be rebuilt with `node previews/build-title-wave-edges.ts` and its `--refine` option.

Every pull request also produces a **site-preview-pr-N** artifact in its **Publish collection** workflow run. Follow the download link in the run summary, unzip the artifact, and open `index.html`. The artifact includes the complete offline site and supporting source files, expires after 14 days, and does not change the public Pages site.

## GitHub Pages

The collection is published at **[thewayiai.com](https://thewayiai.com/)**. GitHub Pages is configured to deploy through GitHub Actions. The [included workflow](.github/workflows/pages.yml) runs the checks described in [Editing and adding topics](#editing-and-adding-topics), including browser acceptance tests, before deploying the clean `_site/` bundle. It does not publish the repository root or build dependencies.

To prepare the publication bundle locally:

```sh
npm run build:site
```

This recreates `_site/` from the same sources, including supporting topic files. Open `_site/index.html` locally to inspect it.

Pull requests run the same checks and build, without deployment. Pushes to `main` and manual runs of **Publish collection** from `main` deploy after checks pass. Local builds and branch previews do not publish the current branch.

See [Reading locally](#reading-locally) for navigation behavior and [AGENTS.md](AGENTS.md#building-and-publishing) for the link-authoring contract.

Reference: [GitHub's custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
