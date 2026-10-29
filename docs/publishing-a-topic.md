# Publishing a topic

You write the Markdown and choose an animal (or pick from suggestions). An agent session does the rest and stops for your approval three times. Throughout, a live preview of the site shows you exactly what readers will see.

This guide is for the author. The rules the agent follows are in [`AGENTS.md`](../AGENTS.md) and the [`publish-topic` skill](../agent-skills/publish-topic/SKILL.md).

## One-time setup

| Need | How |
| --- | --- |
| Node.js 24+ | `node --version` |
| Dependencies | `npm ci` in the repository |
| Browser for tests and sharing cards | `npx playwright install chromium` |
| Codex CLI, signed in with ChatGPT | `npm i -g @openai/codex`, then `codex login` and choose **Sign in with ChatGPT**. `codex login status` should say “Logged in using ChatGPT”. |
| GitHub CLI (for the pull request) | `gh auth status` |

The illustrations are drawn by Codex's built-in image tool, which counts against your ChatGPT plan, not the OpenAI API. The tool refuses to run if Codex is signed in with an API key, so it can't bill the API by accident. Plans have image limits; if you hit one, wait and continue with `--only` (see [Illustration options](#illustration-options)).

## How it fits together

You work with two windows:

- **The agent session** (Claude Code or Codex) in the repository, where you approve and steer.
- **The live preview** in your browser. Start it with `npm run dev` in a terminal and leave it running for the whole session.

There are three places a topic's content can be:

| File | Role |
| --- | --- |
| Your draft, for example `~/drafts/my-idea.md` | The input. It's copied into the repository once, at the start, and never read again. |
| `topics/<id>/README.md` (plus any companion documents) | **The topic from then on.** Every edit, by you or the agent, happens here. |
| `topics/<id>/assets/illustrations/` | The five images and their manifest, written by the illustration generator. |

Everything else (the web pages, the README's topic list, search, the feed) is generated from these files.

## The live preview

```sh
npm run dev
```

It prints a local address, normally http://127.0.0.1:4173/. Open it and keep the tab open. You can start it at any time, even before you have a draft; it shows the site as it is now.

- **Saving rebuilds.** Whenever any file under `topics/`, `pages/` or `design-system/` is saved, by you, the agent or the illustration generator, the site rebuilds in about 6 seconds. Open pages then reload by themselves, keeping your scroll position. A small “Rebuilding…” label shows while it works.
- **Mistakes don't blank the page.** If a change breaks the build (for example a skipped heading level, or a description over 155 characters), the page keeps showing the last version that worked, with a red banner giving the exact error. Fix the file and save; the banner disappears.
- **Only registered topics appear.** A topic is included once its ID is in `topics/topics.json`. Until then the terminal lists it as “Not in the site yet”.
- **Sharing images are skipped.** `dev` doesn't render the social sharing images, to keep rebuilds fast. To see those as well, start it as `npm run dev -- --site`; each rebuild then takes several seconds longer.

You never need to stop the preview or run builds yourself while it's running.

## Write the draft

Write ordinary Markdown anywhere. Only one thing is required: a single `#` title, then your text with `##` chapters and `###` subsections. You don't need front matter, dates or other formatting; the agent adds those and shows you every change.

For a topic with more than one document, keep the companion files next to the draft and say so when you start.

## Publish it, step by step

Start `npm run dev`, then start a session in the repository and ask for it:

```text
/publish-topic ~/drafts/my-idea.md --species "Eurasian otter (Lutra lutra)"
```

In Codex, use `$publish-topic`, or just say “publish ~/drafts/my-idea.md as a new topic”. Leave out the species to get three suggestions.

### 1. Structure (checkpoint 1)

**The agent:**
- copies your draft to `topics/<id>/README.md`;
- prepares its structure:
  - front matter: category, description, thesis and `created` date;
  - an `## Introduction` heading if your opening has none;
  - corrected heading levels;
  - removed draft notices and date lines;
- registers the topic, so it appears in the preview.

It never rewrites, trims or suggests changes to your prose.

**You see:**
- in the session, the proposed ID and metadata, and the diff against your draft;
- in the preview, the topic as readers will see it (the full text, still without artwork), on the homepage and at `/topics/<id>/`.

**You can:**
- tell the agent what to change (“make the category ‘AI practice’”, “created is 2026-09-12”, “use the ID `small-decisions`”);
- or edit `topics/<id>/README.md` yourself.

The preview reloads after each save. Approve when it looks right. Nothing is committed yet, so if you stop here, ask the agent to remove the topic and everything is as before.

### 2. Species

You named one, or you choose from three suggestions. Suggestions are animals the collection doesn't use yet, with visible young for the last two images.

### 3. Illustrations (checkpoint 2)

The generator draws the portrait, then the four panoramas, each in about 1–2 minutes (5–10 in total). Every finished image appears in the preview as soon as it's done:
- **the portrait** on the homepage card and at the top of the topic;
- **each panorama** at a chapter break.

You can keep reading and editing the text meanwhile; text edits and image generation don't interfere.

When all five are done, the agent reports anything wrong it sees (an extra leg, a cut-off tail) and opens a review sheet with all five on light and dark backgrounds. **Approve, or ask for specific images again** (“redo the cubs image, one has three legs”). Only those images are redrawn, and the preview updates as each one lands.

Panoramas sit just before `##` chapters, never before a document's first chapter. A one-chapter topic shows only the portrait; a topic with fewer than five chapters shows fewer panoramas.

### 4. Checks

The agent runs the type checks, the link and structure checks, and the unit and browser tests. It looks at both designs (Atlas and Folio), in light and dark, on desktop and phone widths, and reports anything that fails. Your text and images are already final at this point; this step only verifies them.

### 5. Pull request (checkpoint 3)

The agent lists the files it will commit and asks first. The pull request's CI run builds a downloadable copy of the whole site. **Merging publishes the topic** at https://thewayiai.com/.

Until you merge, you can still change anything. Edit, check the live preview, and ask the agent to commit the change to the same pull request.

## What you can change, and when

| You want to change | Where | When | How it shows |
| --- | --- | --- | --- |
| Wording, headings, code examples | `topics/<id>/*.md` | Any time | Preview reloads on save |
| Title | The `#` line in `topics/<id>/README.md` | Any time | Preview reloads on save |
| Description, thesis, category, dates | The front matter at the top of `topics/<id>/README.md` | Any time | Preview reloads on save |
| One or more images | Ask the agent, or `node scripts/illustrate.ts <id> --only panorama-03` | After step 2 | Each image appears when done |
| The animal | `node scripts/illustrate.ts <id> --species "…" --force` | After step 2 | All five are redrawn |
| The topic ID (its web address) | Ask the agent | Before merging | The topic moves to `/topics/<new-id>/` |
| A published topic | Same files, in a new pull request | After merging | Live after that PR is merged |

Changes to your original draft do nothing once step 1 has copied it. Edit the copy in `topics/<id>/`.

## Doing parts by hand

Every step is an ordinary command, so you can also run it yourself. Keep `npm run dev` running and watch each step land:

```sh
node scripts/add-topic.ts my-idea --from ~/drafts/my-idea.md   # copy the draft into topics/my-idea/README.md
# …add front matter and fix the structure in topics/my-idea/README.md…
node scripts/add-topic.ts my-idea                              # validate front matter and register: now in the preview
node scripts/illustrate.ts --list-species                      # animals already in use
node scripts/illustrate.ts my-idea --species "Eurasian otter (Lutra lutra)"
npm run check && npm test && npm run test:browser              # before committing
```

### Illustration options

| Command | Effect |
| --- | --- |
| `node scripts/illustrate.ts <id> --species "…"` | Draws all five images for a topic that has none |
| `--only panorama-03` (or `hero,panorama-01`) | Redraws only those images, keeping the rest. Panoramas use the current portrait as reference. |
| `--reframe` | Re-runs framing and paper matching on the saved drawings without drawing again |
| `--force` | Redraws all five, or changes the species |

Each image's drawing as generated, its prompt and the Codex log are kept in the ignored `.illustrate/<id>/` folder, along with `review.html` and every replaced version in `previous/`. To go back to an earlier image, copy it from `previous/` over the file in `topics/<id>/assets/illustrations/`.

The tool frames each drawing for its slot. The portrait is 16:9 and centred on the animal; each panorama is 4:1. The tool trims plain paper or extends it, never cuts into the drawing, and matches the paper to the site's background. You never need to resize or edit the files.

## Updating a published topic

Run `npm run dev`, then edit `topics/<id>/` yourself or ask an agent for a specific change. For a substantive change, set `updated: YYYY-MM-DD` in the front matter. Then ask the agent to check and open a pull request. To replace artwork, use `illustrate.ts` with `--only` or `--force`.

## When something goes wrong

| Symptom | Fix |
| --- | --- |
| Red banner in the preview | The message names the file and the problem. Fix it and save. |
| The new topic doesn't appear in the preview | It isn't registered yet: run `node scripts/add-topic.ts <id>` (the agent does this in step 1). The `dev` terminal lists unregistered topics. |
| The preview doesn't update | Check that the `dev` terminal is still running and that you saved under `topics/`, not your original draft. |
| “Codex is not signed in with ChatGPT” | `codex logout`, then `codex login` and choose **Sign in with ChatGPT** |
| “Codex finished without saving …” | Read `.illustrate/<id>/logs/<image>.log`. Usually a plan limit or a refused prompt. Wait, then rerun with `--only <image>`. |
| An image has an anatomy error or a cut-off animal | Rerun with `--only <image>`. Each run is a fresh drawing. |
| Running inside Codex, the illustration step fails with sandbox or network errors | Allow the command to run outside the sandbox; it starts its own Codex session. |
| “The README.md topic table is out of date” | Run `npm run build` (or just save any topic file while `dev` runs). The table is generated; don't edit it by hand. |
| “description has N characters” | Keep it to 155 or fewer. The agent will propose a shorter version in your words. |
