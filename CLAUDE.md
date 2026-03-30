# Dobby AI — Chrome Extension

## Quick Reference

- Build: `npm run build` (output in `dist/`, load in chrome://extensions)
- Dev: `npm run dev` (watch mode)
- Test: `npx vitest run`
- Test single file: `npx vitest run tests/<file>.test.js`
- Test watch: `npm run test:watch`
- E2E: `npm run test:e2e` (builds first, then runs Playwright)
- CI coverage threshold: 80% (hard requirement)

## Architecture

Chrome extension (Manifest V3) using vanilla JS, no frameworks.
- `src/content/` — content script (injected into pages)
  - `trigger/` — text selection trigger, long-press screenshot, progress ring
  - `bubble/` — chat window UI (Shadow DOM), resize, theming
  - `autosuggest/` — autocomplete suggestions
  - `shared/` — shared utilities
  - `api.js` — LLM API client
  - `detection.js` — content type detection
  - `image-capture.js` — screenshot capture
  - `prompt.js` — system prompt construction
  - `presets.js` — preset prompt chips
  - `history.js` — conversation history
- `src/background/` — service worker (API routing, tab capture)
- `src/popup.js` — extension popup UI
- `src/options.js` — settings page
- `proxy/` — rate-limiting Cloudflare Worker (own package.json, wrangler.toml)

Build entry points (`esbuild.config.js`): `src/content/index.js` → `content.js`, `src/background/index.js` → `background.js`, plus popup/options.

## Conventions

- All UI in Shadow DOM for style isolation
- Styles defined in JS via `getStyles()` functions, not external CSS
- Theme: purple (#7c3aed), supports light/dark via OS preference
- Tests use vitest + jsdom — guard `el.closest()` calls for non-element targets
- Fake timers (`vi.useFakeTimers()`) required for testing long-press/timer logic

## Workflow

- Everything through PRs — never push directly to main
- Squash merge via `gh pr merge <n> --squash`
- Always use git worktrees for feature/fix branches — never work directly in the main checkout
- Commit messages: `type: description` (feat/fix/test/ci/docs)
- For UI/UX changes, Playwright visual verification is required BEFORE creating the PR:
  1. Build the extension (`npm run build`)
  2. Load in Playwright persistent context with the extension
  3. Screenshot each visual state and verify correctness
  4. Fix any visual issues before committing
- UI/UX PRs must include a demo GIF in the description
  - Record via Playwright: `node scripts/record-demo.js demos/<scenario>.js /tmp/output.gif --framerate 5`
  - Push to `docs/pr-demo-gifs` branch (non-LFS, <800KB), reference via `raw.githubusercontent.com` URL
  - Do NOT use Git LFS — raw URLs serve pointer files instead of actual content

## Obsidian Project Notes

Project notes are maintained in the Obsidian vault at `../Vibe-Coding-Playground/`.

**Session start:**
1. `obsidian read file="Dobby AI"` for project context
2. `obsidian search query="<topic>"` for related past decisions — don't re-debate settled choices

**During work:** `obsidian search query="..."` to find past decisions and context

**After significant work** (features, fixes, architecture changes), create a session note and link it:

```bash
obsidian create name="Dobby AI — YYYY-MM-DD <Topic>" content="---
tags: [session, dobby-ai]
type: feature|bugfix|refactor|infra
date: YYYY-MM-DD
pr: '#N'
---

# <Topic>

**PR:** [#N](https://github.com/Duobi-AI/dobby-ai/pull/N)
**Branch:** <branch-name>

## What
One paragraph on what was built/fixed.

## Why
Motivation, alternatives considered and rejected.

## Design Decisions
- **Choice** — reasoning

## Files Changed
| File | Change |
|------|--------|

## Testing
What was verified, test counts.

## Open Questions
Anything deferred for later.

[[Dobby AI]]"
```

Then link from the main note:
```bash
obsidian append file="Dobby AI" content="- [[Dobby AI — YYYY-MM-DD <Topic>]] — one-line summary"
```

Keep the main "Dobby AI" note as a high-level overview (architecture, links). Session notes hold the details.
