---
name: publish-topic
description: Use when the author wants to publish a new topic in The Way I AI from a Markdown draft, or to redo a topic's wildlife illustrations. Takes the draft (and optionally the animal species) through structural preparation, registration, Codex-generated illustrations, build checks and a pull request, stopping for the author's approval at each judgment step.
---

# Publish a topic

The author supplies a Markdown draft and, optionally, an animal species. You carry it to a reviewed pull request; merging it publishes the topic. The author-facing guide is `docs/publishing-a-topic.md`; the contracts are in `AGENTS.md` ("Adding a topic", "Editorial structure and shared presentation"). Read both sections before you start.

There are three checkpoints: the **structure diff**, the **illustrations**, and the **pull request**. Stop at each one and wait for the author. Don't commit, push or open a PR until the author says so at checkpoint 3.

## 0. Inputs and setup

- You need the draft's path (and any companion documents). If the author gave a species, keep it for step 4. Ask only for what is missing.
- Work on a branch, never on `main`. If on `main`, run `git switch -c topic/<id>` once the ID is agreed.
- If `node_modules/` is missing, run `npm ci`.

## 1. Prepare the structure (checkpoint 1)

Read the whole draft. Propose a descriptive kebab-case topic ID, then copy the draft into place:

```sh
node scripts/add-topic.ts <id> --from <path/to/draft.md>
```

For a multipart topic, copy the companion files into `topics/<id>/` as well.

**Edit structure only. Never edit prose.** You may:

- Add YAML front matter with:
  - `category`: reuse an existing category where it fits (`grep -h '^category:' topics/*/README.md`).
  - `description`: 155 characters or fewer, built from the author's own sentences wherever possible.
  - `thesis`: one sentence.
  - `created`: the date the author gives you, or today's date if they confirm it. Never invent one. Omit `updated` for a new topic.
  - `documents`: for multipart topics, beginning with `README.md`.
- Make sure there is exactly one `#` title. If the draft has none, ask the author for it.
- Add a `## Introduction` heading above opening text that has no heading. Add the heading only; if there is no opening text, ask the author.
- Fix skipped heading levels by changing the level only, never the wording or numbering.
- Remove manuscript furniture: draft or version notices, duplicated date lines, status footers. Move a creation date into `created`. Keep substantive caveats and limitations.

You may **not** reword, shorten, summarise, reorder or add sentences, rename headings, or "improve" anything. Suggesting prose edits is out of scope too. If the draft needs a content change to be publishable (for example, a missing title), ask instead.

Show the author:

1. the proposed ID, category, description (with its character count), thesis and dates; and
2. the body diff against the draft: `git diff --no-index <draft> topics/<id>/README.md`.

Then list each removal or heading change in one line. Wait for approval, and apply any corrections.

## 2. Register

```sh
node scripts/add-topic.ts <id>
```

This validates the front matter and appends the ID to `topics/topics.json`. The build regenerates the README topic table; never edit that table by hand.

## 3. Build

```sh
npm run build && npm run check
```

Fix any structural errors the build reports (heading levels, titles, links), within the step 1 rules.

## 4. Species

If the author named a species, use it. Otherwise, run `node scripts/illustrate.ts --list-species` and suggest three that:

- aren't already used;
- have visibly distinct young, which images 4 and 5 need;
- read well as a small thumbnail; and
- vary the collection. Note which animal classes are already present.

Write each as `Common name (Binomial)`, for example `Eurasian otter (Lutra lutra)`, with one line on why it suits. The author chooses. Don't tie the animal to the article's subject.

## 5. Illustrations (checkpoint 2)

```sh
node scripts/illustrate.ts <id> --species "Common name (Binomial)"
```

- **Running it.** It takes about 1–2 minutes per image (5–10 in total), so run it in the background if you can. It drives the Codex CLI, signed in with the author's ChatGPT plan, so the images count against their subscription rather than API billing. It refuses an API-key login.
- **Running inside Codex.** The script starts its own `codex exec`. That needs network access and `~/.codex`, so request permission to run it outside the sandbox.
- **What it does.** The portrait is drawn first; the panoramas are drawn with it attached, so they show the same animals. The script then frames, sizes and paper-matches each image, writes `assets/illustrations/manifest.json`, and creates `.illustrate/<id>/review.html`.
- **Review the five final images yourself** (`topics/<id>/assets/illustrations/*.png`). Check:
  - anatomy: number of legs, paws, ears, eyes and tails; joints; the right number of animals;
  - complete silhouettes with margins;
  - the young in images 4–5;
  - style consistent with the references; and
  - no visible paper boxes.

Report what you see honestly. Then show the author the review sheet (`open .illustrate/<id>/review.html` on macOS) and wait for approval. To redo images, use:

- `--only panorama-03` (comma-separated for several) to regenerate specific images;
- `--reframe` to re-process the saved drawings without generating new ones;
- `--force` to replace the species or all five images.

Earlier versions are kept in `.illustrate/<id>/previous/`.

## 6. Verify

```sh
npm run typecheck && npm run build && npm run check && npm test
npx playwright install chromium   # first time only
npm run test:browser
```

Then run `npm run preview` and look at the homepage and the new topic in both designs (Atlas and Folio), light and dark, at desktop width and at 390px. Check:

- the title, description and dates;
- the portrait on the homepage and topic;
- the panoramas between chapters;
- the outline and full text; and
- code blocks, if any.

Take screenshots if you have browser tooling; otherwise ask the author to look. Report failures with their output.

## 7. Publish (checkpoint 3)

Summarise what will be committed:

- `topics/<id>/`: README, companion documents, `assets/illustrations/`;
- `topics/topics.json`; and
- `README.md`.

Never commit `_site/` or `.illustrate/`. When the author says to proceed, commit, push and open a PR that shows the topic title, species and verification results. The PR's CI build produces a downloadable preview; merging to `main` deploys the site.

## Updating an existing topic

Prose changes are the author's. After a substantive content change, set `updated` in the front matter, then run step 3 and step 6. To redo artwork, run step 5 with `--only` or `--force`.
