# Decorative red fox illustration family

Species: red fox (*Vulpes vulpes*).

These images are decorative wildlife artwork, independent of the article's content. They do not explain JEC, represent its concepts, or have semantic chapter assignments. The version 3 manifest lets the shared build distribute the four panoramas automatically in reading order. Empty alt text is intentional.

The files are derived from the approved illustration references below. Their edge-connected pale paper has been matched to the light theme's `--paper` color (`#f8f5ee`); dark ink and colored artwork are left untouched, with a soft blend at pale edges. Dimensions and filenames are unchanged.

| Topic asset | Reference source under `design-system/illustration-style/references/` | Dimensions |
| --- | --- | --- |
| `hero.png` | `01_fox_portrait_1600x900.png` | 1600 × 900 |
| `panorama-01.png` | `02_fox_running_natural_pose_1600x400.png` | 1600 × 400 |
| `panorama-02.png` | `03_fox_foraging_1600x400.png` | 1600 × 400 |
| `panorama-03.png` | `04_fox_cubs_playing_1600x400.png` | 1600 × 400 |
| `panorama-04.png` | `05_foxes_at_stream_1600x400.png` | 1600 × 400 |

The portrait is reused at full 16:9 on the homepage and article top, preserving the complete head. Panoramas display at their native 4:1 ratio. Original references remain untouched in the design-system folder. Regenerate the paper treatment with `node scripts/prepare-fox-paper.ts` (requires Playwright Chromium); the script reads the light-theme color from shared CSS and always starts from those originals. No article text was changed.
