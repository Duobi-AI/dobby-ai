# Dobby AI Logo Assets

Use `dobby-logo.svg` as the primary logo tile for web, docs, and places where SVG is accepted.

Use `dobby-logo-mark.svg` when the logo needs a transparent background, such as floating UI, toolbar buttons, and compact lockups.

Chrome extension manifests still need PNG icon files, so `icon16.png`, `icon48.png`, and `icon128.png` are generated from the SVG tile master by `scripts/generate-icons.js`.

Source files:

- `dobby-logo-source.png`: approved 512px artwork source.
- `dobby-logo.svg`: scalable logo tile wrapper preserving the approved artwork.
- `dobby-logo-mark.svg`: scalable transparent mark wrapper.
- `dobby-logo-mark.png`: compact 128px transparent mark used in bundled data URIs.
- `dobby-logo-mark-512.png`: high-resolution transparent mark used by the SVG mark.
