# The Way I AI — Wildlife illustrations

[The generation prompt](single-topic-illustration-prompt.md) is the sole image-generation prompt and the single source of the style. Approved reference examples live in `references/`. Only the species is a creative input: no topic name, article research, or relationship between wildlife and article content is needed.

## Generating with Codex (the usual path)

```sh
node scripts/illustrate.ts <topic-id> --species "Eurasian otter (Lutra lutra)"
```

`scripts/illustrate.ts` makes one `codex exec` run per image with Codex's built-in image tool. Codex must be signed in with ChatGPT, so images count against the ChatGPT plan. The script refuses an API-key login unless `--allow-api-billing` is passed.

1. **The brief.** Each run gets the master prompt with only its own `### IMAGE N` section and without section 8 (the delivery package), plus every file in `references/`.
2. **The portrait first.** The panoramas are drawn with the finished `hero.png` attached, so all five show the same animals.
3. **Framing.** Codex saves the tool's raw drawing; the script owns everything after that. Image tools return roughly 16:9 or at most about 2.5:1, never 4:1. The script finds the drawing on its paper and uses the largest window at the target ratio that keeps the whole drawing plus a margin. When none fits inside the image, it extends the paper instead. It never crops into the drawing.
4. **Finishing.** It resizes to exactly 1600 × 900 or 1600 × 400, matches edge-connected paper to `#F8F5EE` (`scripts/paper.ts`, shared with `prepare-paper.ts`), centres the portrait horizontally when there is room, and writes the version 3 manifest.
5. **Work area.** Raw drawings, prompts, Codex logs, replaced versions and `review.html` stay in the ignored `.illustrate/<topic-id>/`.

Options:
- `--only hero,panorama-03` redraws specific images.
- `--reframe` re-processes saved drawings without drawing again.
- `--force` redraws all five or changes the species.
- `--list-species` shows the animals already in use.

The species must be written `Common name (Binomial)`; the Field Atlas label shows both. Review every image for anatomy before committing: the script checks sizes and paper, not legs. The [publishing guide](../../docs/publishing-a-topic.md) describes the whole author workflow.

## Manual delivery (fallback)

The prompt can also be used in any image tool that accepts attachments. Set **Animal species**, attach the references (any number, at least one), and request the ZIP described below.

### Delivery format

The ZIP contains six files at its root, without an enclosing directory:

```text
manifest.json          # version 3, species, five ordered image entries
hero.png               # 1600 × 900 adult portrait
panorama-01.png         # 1600 × 400 adult in action
panorama-02.png         # 1600 × 400 adult natural behavior
panorama-03.png         # 1600 × 400 playful young animals
panorama-04.png         # 1600 × 400 young animals exploring
```

The prompt includes the exact manifest JSON. Its `species` is descriptive metadata, not a topic ID. Each entry has `file`, `placement` (`hero` or `panorama`), `alt: ""`, `width`, and `height`. Keep all five entries in order, even during partial file delivery. Do not add topic, document, heading, caption, or prose fields. PNG, WebP, and JPEG are accepted with matching extensions and unchanged ratios; use one format per image, not duplicate exports.

Clear paper uses sRGB **`#F8F5EE`**, matching the light theme's `--paper`. The same opaque assets work in both themes. No dark-mode variants, CSS inversion, or runtime rendering dependencies are needed.

### Integrating a delivery

1. Inspect the ZIP's file list; it must contain only the expected images and manifest, with no scripts, HTML, or enclosing directory.
2. Choose the destination topic locally. Back up any prior illustration folder you want to keep.
3. Extract directly into `topics/<topic-id>/assets/illustrations/`.
4. If the delivered paper drifts from `#F8F5EE`, run `node scripts/prepare-paper.ts <topic-id>` (see below).
5. Run `npm run build`, or `npm run build:site` and refresh a running preview.
6. Review desktop/narrow rendering in light and dark themes and run the checks below.

No metadata edits, import script, or generated-page edits are needed. Commit extracted images and manifest; generated output stays ignored. Delivery ZIPs are ignored and must not be committed.

The generator must actually create the images and archive before claiming success. An image-only tool may need a file-capable workspace to write the JSON and ZIP; otherwise download the five individual images and save the supplied manifest yourself. Do not mislabel file formats or assume that renaming an extension converts an image.

## Rendering contract

- The same **full, uncropped 16:9 portrait** is used on the homepage and at the article top, preserving the animal's complete head and balanced margins.
- The four **4:1 panoramas** are decorative interludes inserted before chapter headings, not semantic illustrations of those chapters. Empty alt text keeps screen-reader reading uninterrupted. No captions or new headings are added.
- Eligible boundaries are authored `##` headings across listed documents in reading order, excluding each document's first chapter. For `N` eligible boundaries, use `K = min(4, N)` slots at zero-based indices `floor(i * N / K)`, for `i = 0…K-1`. Images 1 through K occupy those slots in order. Short articles use fewer panoramas; a document with only one chapter has no interlude boundary. No topic-specific rules or content matching are involved.
- Slots are assigned before checking file availability, so a missing panorama does not move the others. Missing images add no broken markup. A missing portrait leaves the homepage slot empty; no manifest means no illustrations. Files not named by the active manifest are ignored.
- Invalid metadata fails validation before output changes. Unknown fields, unsafe or out-of-order filenames, invalid declared ratios, and nonempty decorative alt text are rejected.
- Artwork follows the [shared asset delivery contract](../README.md#build-contract). Dropping in new files requires a rebuild, not just a refresh. The build validates declared dimensions/ratios; browser acceptance checks actual raster dimensions for the delivered JEC assets. Review anatomical quality and actual export dimensions before publishing.
- Older manifest versions 1/2 remain readable for compatibility, but all new deliveries use the species-only version 3 contract. There is no separate legacy generation prompt.

## JEC reference copies

The fox artwork in `topics/just-enough-context/assets/illustrations/` is derived from the approved references, with pale paper matched to the light background. To regenerate that treatment from untouched originals, run:

```sh
node scripts/prepare-fox-paper.ts
```

This maintenance script requires Playwright Chromium and reads the light-theme color from shared CSS. Provenance is recorded in the topic's `image-plan.md`; the original references remain unchanged.

## Matching delivered paper

Deliveries whose clear paper drifts from `#F8F5EE` show as visible boxes on the page and in Field Atlas mounts. Match a topic's delivered images in place, and optionally centre an off-centre portrait horizontally:

```sh
node scripts/prepare-paper.ts web-app-starter-kit agent-roles
node scripts/prepare-paper.ts worktrees --center-hero
```

Only edge-connected pale paper changes; ink and coloured watercolour stay untouched. The worktrees, agent-roles and web-app-starter-kit artwork was matched this way, and the squirrel portrait was centred.

## Verification

```sh
npm run typecheck
npm run build
npm run check
npm test
npm run test:browser
```

Inspect the portrait, interlude spacing, full animal silhouettes, native ratios, missing-image behavior, light/dark rendering, narrow screens, offline behavior, and output file size. See the root README for [publication bundle usage](../../README.md#publishing-to-github-pages-notes-to-self).
