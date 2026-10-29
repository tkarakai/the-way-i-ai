# Publishing a topic

You write the Markdown and choose an animal (or pick from suggestions); an agent session does the rest and stops for your approval three times. This guide is for the author. The rules the agent follows are in [`AGENTS.md`](../AGENTS.md) and the [`publish-topic` skill](../agent-skills/publish-topic/SKILL.md).

## One-time setup

| Need | How |
| --- | --- |
| Node.js 24+ | `node --version` |
| Dependencies | `npm ci` in the repository |
| Browser for tests and sharing cards | `npx playwright install chromium` |
| Codex CLI, signed in with ChatGPT | `npm i -g @openai/codex`, then `codex login` and choose **Sign in with ChatGPT**. `codex login status` should say “Logged in using ChatGPT”. |
| GitHub CLI (for the pull request) | `gh auth status` |

The illustrations are drawn by Codex's built-in image tool, which counts against your ChatGPT plan, not the OpenAI API. The tool refuses to run if Codex is signed in with an API key, so it can't bill the API by accident. Plans have image limits; if you hit one, wait and continue with `--only` (see below).

## Write the draft

Write ordinary Markdown anywhere, for example `~/drafts/my-idea.md`. Only one thing is required: a single `#` title, then your text with `##` chapters and `###` subsections. You don't need front matter, dates or any other formatting; the agent adds those and shows you every change.

For a topic with more than one document, keep the companion files next to the draft and say so when you start.

## Publish it

Start a session in the repository, in Claude Code or Codex, and ask for it:

```text
/publish-topic ~/drafts/my-idea.md --species "Eurasian otter (Lutra lutra)"
```

In Codex, use `$publish-topic`, or just say “publish ~/drafts/my-idea.md as a new topic”. Leave out the species to get three suggestions.

The agent then works through these steps:

1. **Structure (checkpoint 1).** It proposes a topic ID, category, description, thesis and `created` date, and prepares the document's structure:
   - front matter;
   - an `## Introduction` heading if your opening has none;
   - corrected heading levels;
   - removed draft notices and date lines.

   It shows you the diff against your draft. It never rewrites, trims or suggests changes to your prose. **You approve or correct.**
2. **Registration.** The ID is appended to `topics/topics.json`. The README's topic table is regenerated automatically.
3. **Species.** Yours, or three suggestions that aren't already used and have young animals to draw. **You choose.**
4. **Illustrations (checkpoint 2).** Five images, about 5–10 minutes in total: a portrait, then four panoramas drawn with the portrait as reference, so they show the same animals. The agent checks the anatomy and opens a review sheet showing all five on light and dark backgrounds. **You approve, or ask for specific images again.**
5. **Verification.** Type checks, build, link checks, unit and browser tests, then a look at both designs in light and dark, on desktop and phone widths.
6. **Pull request (checkpoint 3).** It summarises the files and asks before committing. The PR's CI run builds a downloadable preview. **Merging publishes the topic** at https://thewayiai.com/.

You can steer at any point. For example: “use ‘AI practice’ as the category”, “the created date is 2026-09-12”, or “redo the cubs image, one of them has three legs”.

## Doing parts by hand

Every step is an ordinary command, so you can also run it yourself:

```sh
node scripts/add-topic.ts my-idea --from ~/drafts/my-idea.md   # copy the draft into topics/my-idea/README.md
node scripts/add-topic.ts my-idea                              # validate front matter and register
node scripts/illustrate.ts --list-species                      # animals already in use
node scripts/illustrate.ts my-idea --species "Eurasian otter (Lutra lutra)"
npm run build && npm run check && npm test
npm run preview                                                # read it locally
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

Edit the Markdown yourself, or ask an agent to make a specific change. For a substantive change, set `updated: YYYY-MM-DD` in the front matter. Rebuild, check, and open a PR as above. To replace artwork, use `illustrate.ts` with `--only` or `--force`.

## When something goes wrong

| Symptom | Fix |
| --- | --- |
| “Codex is not signed in with ChatGPT” | `codex logout`, then `codex login` and choose **Sign in with ChatGPT** |
| “Codex finished without saving …” | Read `.illustrate/<id>/logs/<image>.log`. Usually a plan limit or a refused prompt. Wait, then rerun with `--only <image>`. |
| An image has an anatomy error or a cut-off animal | Rerun with `--only <image>`. Each run is a fresh drawing. |
| Running inside Codex, the illustration step fails with sandbox or network errors | Allow the command to run outside the sandbox; it starts its own Codex session. |
| “The README.md topic table is out of date” | Run `npm run build`. The table is generated; don't edit it by hand. |
| “description has N characters” | Keep it to 155 or fewer. The agent will propose a shorter version in your words. |
