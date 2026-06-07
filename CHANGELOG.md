# Changelog

All notable changes to Dobby AI (formerly Ask AI) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2026-06-07

### Changed
- Added scalable Dobby AI SVG logo assets for docs, README, popup, options, and reusable brand placements.
- Updated the icon generation pipeline to produce SVG masters, Chrome extension PNG icons, docs copies, and bundled brand data from the approved source artwork.
- Centralized semantic UI colors and shared theme resolution so future palette changes can be made from one source.
- Applied the Hearthlight ivory, amber, walnut, and graphite palette across light and dark modes.

### Fixed
- Fixed light, dark, and auto theme propagation across popup, options, toolbar, and response bubble surfaces.
- Centered the Dobby logo consistently in collapsed and expanded toolbar states.

## [1.2.1] - 2026-05-27

### Changed
- Replaced legacy logo assets with the approved centered Dobby AI cockapoo logo across the extension, docs, screenshots, and generated icon sizes

## [1.2.0] - 2026-05-26

### Added
- Popup usage monitor with API status, request/token totals, and quick actions for history, clearing usage, and settings
- Keyboard shortcuts for toggling Dobby AI and screenshot mode
- Per-message copy button for AI responses
- Popup controls for theme, screenshot mode, and auto-suggest behavior

### Changed
- Hardened CI/CD workflows and refreshed release documentation

### Fixed
- Dependency advisories in extension and proxy lockfiles
- Auto-suggest initialization and token-limit handling
- Selected image handling, prompt budgeting, and null image capture inputs

## [2.1.0] - 2026-03-11

### Changed
- Foreign language presets now prioritize native-language actions (Summarize, Explain simply) over translation, since the system prompt already responds in the user's language
- Updated README to reflect v2.0 architecture and features

## [2.0.0] - 2026-03-11

### Added
- **Inline AI responses** — frosted glass bubble UI with streaming markdown rendering, replacing the old "open in new tab" flow
- **Cloudflare Worker proxy server** — HMAC-SHA256 signed requests, sliding window + burst rate limiting, OpenAI SSE relay
- **Follow-up conversations** — ask follow-up questions within the same bubble with full conversation history
- **Language-aware responses** — AI responds in the same language as the selected text
- **Selected text preview** — shows captured text in both preset selector and response bubble
- **Text highlight preservation** — selecting text no longer loses the browser highlight when the preset selector opens
- **DOM-based code detection** — walks up from selection anchor to find `<pre>`/`<code>` tags for higher-confidence code detection
- **Viewport overflow handling** — bubble repositions above selection when near the bottom of the viewport
- **Options page** — settings UI for API key management with validation
- **Conversation history module** (`history.js`) — manages multi-turn conversations
- **API key validation module** (`api.js`) — validates OpenAI API keys via `GET /v1/models`
- **Timing-safe HMAC comparison** — constant-time XOR comparison to prevent timing attacks on the proxy

### Changed
- Renamed from "Ask AI" to "Dobby AI"
- Rewrote `background.js` as SSE streaming relay instead of tab opener
- Rewrote `prompt.js` with system message architecture (instruction + text combined in user message)
- Rewrote `trigger.js` with text preview, detection badge, and wider preset selector
- Content detection (`detection.js`) now returns rich objects with `subType`, `confidence`, and metadata
- `host_permissions` scoped to specific proxy worker domain instead of broad wildcard
- SSE parser handles `\r\n` line endings

### Removed
- `popup.js` — replaced by inline `bubble.js`
- Direct ChatGPT/Claude URL-opening flow — replaced by proxy-based streaming

### Fixed
- `detectContent` vs `detectContentType` function name mismatch that silently broke all content detection
- Proxy crash from Cloudflare KV `expirationTtl` below 60-second minimum
- CORS fallback no longer leaks extension ID
- Body size enforcement reads actual body instead of trusting `Content-Length` header
- Upstream OpenAI error details no longer leaked to client

### Security
- HMAC signs full message payload (was previously truncated to 100 chars)
- Timing-safe signature comparison
- Scoped `host_permissions` to proxy domain only

## [1.1.0] - 2026-03-11

### Added
- Enhanced smart detection engine with sub-types (JavaScript, Python, Rust, Go, SQL, Java, C/C++, Ruby, PHP) and rich metadata (confidence scores, word/char counts)
- Foreign language sub-type detection (Japanese, Chinese, Korean, Arabic, Russian, Hindi, Thai)
- Frosted glass popup redesign with accessibility improvements
- Privacy policy for Chrome Web Store listing

### Changed
- Increased text and URL limits
- Hardened context menu fallback

## [1.0.0] - 2026-03-11

### Added
- Initial release
- Floating trigger button on text selection
- Smart content detection (code, foreign language, error, email, data, math)
- Preset prompts per content type
- Custom instruction input
- ChatGPT and Claude AI selector
- Context menu fallback for CSP-blocked pages
- Shadow DOM popup UI
- Page context injection (title + URL)
- CI/CD workflows (tests, coverage, security, release, PR preview, permission guard)

[1.2.2]: https://github.com/Duobi-AI/dobby-ai/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/Duobi-AI/dobby-ai/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Duobi-AI/dobby-ai/compare/v1.1.0...v1.2.0
[2.1.0]: https://github.com/Duobi-AI/dobby-ai/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Duobi-AI/dobby-ai/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/Duobi-AI/dobby-ai/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Duobi-AI/dobby-ai/releases/tag/v1.0.0
