# Background motion studies

Open **[backgrounds.html](backgrounds.html)** directly in a browser. It is fully offline and separate from the published site.

Rebuild from the current homepage and the authored TypeScript/CSS:

```sh
npm run preview:backgrounds
```

The gallery has six animated thumbnails. Click one for a viewport-filling review behind the actual homepage. Light/Dark, Pause/Play, intensity, and background-only controls apply only to the review. Left/right arrows switch studies; Escape returns to the gallery. Hashes such as `backgrounds.html#D` open a study directly.

| Study | Direction |
| --- | --- |
| **A · Contour drift** | The preserved favorite, using the original site's CSS directly. At 100% intensity the original treatment is unchanged. |
| **B · Silk current** | Two ruled, twisting thread surfaces form flowing ribbons. This replaces the rejected prismatic-light B experiment. |
| **C · Waterlight** | Procedural refractive cells and bright caustic seams. |
| **D · Orbital ink** | A projected three-dimensional torus woven from fine copper and teal loops. |
| **E · Paper eclipse** | Layered cut-paper discs with moving negative space and directional shadows. |
| **F · Murmuration** | Deterministic coordinated particles with short trails, forming a changing silhouette. |

**F at 20% intensity is selected on the main site.** A remains preserved here and in the shared stylesheet. Review controls do not change site preferences or the production configuration.

## Sources

- `build-backgrounds.ts`: embeds the current homepage's fonts, wordmark and content, exact A styles, review CSS, and compiled TypeScript in one HTML file.
- `backgrounds.css`: gallery and full-screen review presentation.
- `backgrounds-ui.ts`: Canvas 2D studies B–E and preview interactions. No remote assets, dependencies or random seed variance.
- `../design-system/murmuration.ts`: study F's renderer, shared unchanged with the homepage.
- `backgrounds.html`: generated output; do not edit directly.

Only visible canvases render, at a maximum of 30 fps and capped pixel density. Opening a study suspends the thumbnail renderers. Background tabs stop rendering; Pause works for CSS and Canvas. Reduced-motion users start paused and can explicitly opt in with Play. Responsive layouts work at 320px as well as desktop widths.
