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

Codex draws the illustrations with its built-in image tool, which counts against your ChatGPT plan, not the OpenAI API. The illustration step refuses to run if Codex is signed in with an API key, so it can't bill the API by accident.

## How it fits together

You work with two windows:

- **The agent session** (Claude Code or Codex) in the repository, where you approve and steer.
- **The live preview** in your browser, which shows the site exactly as readers will see it and updates by itself.

Each topic has an **ID**: a short name in lowercase words joined by hyphens, such as `small-decisions`. It names the topic's folder and appears in its web address (`/topics/small-decisions/`). The agent proposes one at the start, and you can change it.

A topic's content lives in three places:

| File | Role |
| --- | --- |
| Your draft, for example `~/drafts/my-idea.md` | The input. It's copied into the repository once, at the start, and never read again. |
| `topics/<id>/README.md` (plus any companion documents) | **The topic from then on.** Every edit, by you or the agent, happens here. |
| `topics/<id>/assets/illustrations/` | The five wildlife images and their manifest. The agent creates them with the illustration generator. |

Everything else (the web pages, the README's topic list, search, the feed) is generated from these files.

## Write the draft

Write ordinary Markdown anywhere. Only one thing is required: a single `#` title, then your text with `##` chapters and `###` subsections. You don't need front matter, dates or other formatting; the agent adds those and shows you every change.

For a topic with more than one document, keep the companion files next to the draft and say so when you start.

## Open the live preview

Before you start publishing, run this once in a terminal in the repository:

```sh
npm run dev
```

It prints a local address, normally http://127.0.0.1:4173/. Open it in your browser. It shows the site as it is now; your topic joins it during step 1. Leave the terminal and the tab open for as long as you're working. Everything below assumes the preview is running.

- **Saving rebuilds.** Whenever any file under `topics/`, `pages/` or `design-system/` is saved, by you, the agent or the illustration generator, the site rebuilds in about 6 seconds. Open pages then reload by themselves, keeping your scroll position. A small “Rebuilding…” label shows while it works.
- **Mistakes don't blank the page.** If a change breaks the build (for example a skipped heading level, or a description over 155 characters), the page keeps showing the last version that worked, with a red banner giving the exact error. Fix the file and save; the banner disappears.
- **Only registered topics appear.** A topic is included once its ID is in `topics/topics.json`, which the agent does in step 1. Until then the preview's terminal lists it as “Not in the site yet”.
- **Sharing images are skipped.** The preview doesn't render the social sharing images, to keep rebuilds fast. If you want to see those too, start it with `npm run dev -- --site` instead; each rebuild then takes several seconds longer.

You never need to restart the preview or run builds yourself.

## Publish it, step by step

Start an agent session in the repository and ask for it:

```text
/publish-topic ~/drafts/my-idea.md --species "Eurasian otter (Lutra lutra)"
```

In Codex, use `$publish-topic`, or just say “publish ~/drafts/my-idea.md as a new topic”. The species is optional; write it as the common name followed by the scientific name in brackets, as above. Leave it out to get three suggestions in step 2.

### 1. Structure (checkpoint 1)

**The agent:**
- proposes an ID and copies your draft to `topics/<id>/README.md`;
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

If you gave a species in your request, the agent uses it. Otherwise it suggests three animals the collection doesn't use yet, all with visible young (the last two images show young animals), and you choose.

### 3. Illustrations (checkpoint 2)

The agent runs the illustration generator. It draws the portrait first, then the four panoramas with the portrait as reference, so all five show the same animals. Each image takes about 1–2 minutes (5–10 in total) and appears in the preview as soon as it's done:
- **the portrait** on the homepage card and at the top of the topic;
- **each panorama** at a chapter break.

You can keep reading and editing the text meanwhile; text edits and image generation don't interfere.

Panoramas sit just before `##` chapters, never before a document's first chapter. A one-chapter topic shows only the portrait; a topic with fewer than five chapters shows fewer panoramas.

When all five are done, the agent reports anything wrong it sees (an extra leg, a cut-off tail) and opens a review sheet with all five on light and dark backgrounds. **Approve, or ask for specific images again** (“redo the cubs image, one has three legs”). Only those images are redrawn, and the preview updates as each one lands. If your plan's image limit stops the generator partway, wait and ask the agent to finish the missing images.

### 4. Checks

The agent runs the type checks, the link and structure checks, and the unit and browser tests. It also looks at both designs (Atlas and Folio), in light and dark, on desktop and phone widths, and reports anything that fails. This step creates nothing new; it verifies what you've approved.

### 5. Pull request (checkpoint 3)

The agent lists the files it will commit and asks for your go-ahead before committing. It then opens a pull request, whose CI run repeats the checks and builds a downloadable copy of the whole site. **Merging publishes the topic** at https://thewayiai.com/.

Until you merge, you can still change anything: edit, check the preview, and ask the agent to add the change to the same pull request.

## What you can change, and when

| You want to change | How | When | Shows in the preview |
| --- | --- | --- | --- |
| Wording, headings, code examples | Edit `topics/<id>/*.md`, or ask the agent | From step 1 | On save |
| Title | The `#` line in `topics/<id>/README.md` | From step 1 | On save |
| Description, thesis, category, dates | The front matter at the top of `topics/<id>/README.md` | From step 1 | On save |
| The topic ID (its web address) | Ask the agent | Until you merge | The topic moves to `/topics/<new-id>/` |
| One or more images | Ask the agent which ones to redraw | From step 3 | Each image as it's done |
| The animal | Ask the agent for a different species | From step 3 | All five are redrawn |
| A published topic | Any of the above, in a new pull request | After merging | On save; live once that pull request is merged |

Changes to your original draft do nothing once step 1 has copied it. Edit the copy in `topics/<id>/`.

## Updating a published topic

Edit `topics/<id>/` yourself, or ask an agent for a specific change, and check the result in the preview. For a substantive change, set `updated: YYYY-MM-DD` in the front matter. Then ask the agent to run the checks and open a pull request. To replace artwork, ask it to redraw specific images or the whole set.

## Doing it by hand

Everything the agent does is an ordinary command, so you can also run the steps yourself. The preview shows the result of each one:

```sh
node scripts/add-topic.ts my-idea --from ~/drafts/my-idea.md   # step 1: copy the draft into topics/my-idea/README.md
# …add front matter and fix the structure in topics/my-idea/README.md…
node scripts/add-topic.ts my-idea                              # step 1: validate the front matter and register; now in the preview
node scripts/illustrate.ts --list-species                      # step 2: animals already in use
node scripts/illustrate.ts my-idea --species "Eurasian otter (Lutra lutra)"   # step 3
npm run check && npm test && npm run test:browser              # step 4
```

### Illustration options

| Command | Effect |
| --- | --- |
| `node scripts/illustrate.ts <id> --species "…"` | Draws all five images for a topic that has none |
| `--only panorama-03` (or `hero,panorama-01`) | Redraws only those images, keeping the rest. Panoramas use the current portrait as reference. |
| `--reframe` | Re-runs framing and paper matching on the saved drawings without drawing again |
| `--force` | Redraws all five, or changes the species |

Each image's drawing as generated, its prompt and the Codex log are kept in the ignored `.illustrate/<id>/` folder, along with `review.html` and every replaced version in `previous/`. To go back to an earlier image, copy it from `previous/` over the file in `topics/<id>/assets/illustrations/`.

The generator frames each drawing for its slot. The portrait is 16:9 and centred on the animal; each panorama is 4:1. It trims plain paper or extends it, never cuts into the drawing, and matches the paper to the site's background. You never need to resize or edit the files.

## When something goes wrong

| Symptom | Fix |
| --- | --- |
| Red banner in the preview | The message names the file and the problem. Fix it and save. |
| The new topic doesn't appear in the preview | It isn't registered yet; the agent does this in step 1 (by hand: `node scripts/add-topic.ts <id>`). The preview's terminal lists unregistered topics. |
| The preview doesn't update | Check that the preview's terminal is still open (if you closed it, run `npm run dev` again) and that you saved under `topics/`, not your original draft. |
| “Codex is not signed in with ChatGPT” | `codex logout`, then `codex login` and choose **Sign in with ChatGPT** |
| “Codex finished without saving …” | Read `.illustrate/<id>/logs/<image>.log`. Usually a plan limit or a refused prompt. Wait, then redraw that image (`--only <image>`). |
| An image has an anatomy error or a cut-off animal | Ask the agent to redraw it (`--only <image>`). Each run is a fresh drawing. |
| Running inside Codex, the illustration step fails with sandbox or network errors | Allow the command to run outside the sandbox; it starts its own Codex session. |
| “The README.md topic table is out of date” | Save any topic file so the preview rebuilds, or run `npm run build`. The table is generated; don't edit it by hand. |
| “description has N characters” | Keep it to 155 or fewer. The agent will propose a shorter version in your words. |
