# Site icons

Approved cropped wordmark: “y I” above “AI”, without the wave. The upper I is aligned to the lower I. Blue `#3878f2` above teal `#00a99d`, on transparency.

- `favicon.ico`: bundled 16, 32, and 48px PNG images for browser fallback.
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`: browser-sized PNGs.
- `apple-touch-icon.png`: 180px home-screen icon.
- `favicon-192.png`, `favicon-512.png`: larger icons for potential manifest use. No manifest or installable-app behavior is currently configured.

The build copies these approved assets into `_site/` without regenerating them. Every page links the ICO fallback, Apple touch icon, and 16px and 32px PNGs as relative shared files. The larger PNGs are published for future use, but no web-app manifest is configured.

These are approved raster assets. When replacing them, preserve the wordmark's optical A adjustment, align the I glyph origins, crop the visible ink, and scale uniformly. Inspect replacements at each published size. An outlined vector SVG would be a separate future addition.

These branding assets are excluded from the repository’s MIT and Creative Commons licenses; see the root `LICENSE`.
