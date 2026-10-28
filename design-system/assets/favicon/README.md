# Site icons

Approved cropped wordmark: “y I” above “AI”, without the wave. The upper I is aligned to the lower I. Blue `#3878f2` above teal `#00a99d`, on transparency.

- `favicon.ico`: bundled 16, 32, and 48px PNG images for browser fallback.
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`: browser-sized PNGs.
- `apple-touch-icon.png`: 180px home-screen icon.
- `favicon-192.png`, `favicon-512.png`: larger icons for potential manifest use. No manifest or installable-app behavior is currently configured.

The build copies these approved assets to the root and publication bundle without regenerating them. Every page links the ICO fallback and Apple touch icon using relative paths; 16px and 32px PNGs are embedded in the head so individual downloaded HTML files retain their browser icon. The larger PNGs are published for future use, but no web-app manifest is configured.

Regenerate from the current root `index.html` with `node previews/favicon.ts`. The script uses the existing embedded wordmark font and its optical A adjustment, aligns the I glyph origins, crops the visible ink, and scales uniformly. Inspect previews after regeneration, especially if the wordmark changes. These are raster assets; an outlined vector SVG would be a separate future addition.

These branding assets are excluded from the repository’s MIT and Creative Commons licenses; see the root `LICENSE`.
