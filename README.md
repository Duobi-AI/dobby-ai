<p align="center">
  <img src="icons/dobby-logo.svg" alt="Dobby AI" width="80" />
</p>

<h1 align="center">Dobby AI</h1>

<p align="center">
  <strong>Select text or screenshot any region on the web — get instant AI answers right where you are.</strong>
</p>

<p align="center">
  <a href="https://github.com/Duobi-AI/dobby-ai/actions/workflows/ci.yml"><img src="https://github.com/Duobi-AI/dobby-ai/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Duobi-AI/dobby-ai/actions/workflows/security.yml"><img src="https://github.com/Duobi-AI/dobby-ai/actions/workflows/security.yml/badge.svg" alt="Security"></a>
  <a href="https://github.com/Duobi-AI/dobby-ai/actions/workflows/coverage.yml"><img src="https://github.com/Duobi-AI/dobby-ai/actions/workflows/coverage.yml/badge.svg" alt="Coverage"></a>
  <img src="https://img.shields.io/badge/version-1.2.1-blue" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-green" alt="Manifest V3">
  <a href="https://github.com/Duobi-AI/dobby-ai/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow" alt="License"></a>
  <a href="https://chromewebstore.google.com/detail/fobblgpebpnelefaneijkpbcljdlofoo?utm_source=item-share-cb"><img src="https://img.shields.io/badge/chrome-web%20store-orange?logo=googlechrome&logoColor=white" alt="Chrome Web Store"></a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
  <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/zhongnansu/67d3ff04e606234417bba6bca0f60d85/raw/tokens.json" alt="Repo Tokens">
</p>

<p align="center">
  Zero tab-switching · Inline AI responses · Visual intelligence · Smart content detection
</p>

---

Dobby AI is a Chrome extension that brings AI directly into your browsing workflow. Select text to get instant explanations, or **long-press anywhere to screenshot a region and ask AI about what you see** — charts, diagrams, code, error messages, anything on screen. All responses appear in a frosted glass bubble right next to your selection, no tab-switching required.

## What Makes Dobby AI Different?

**Visual intelligence built in.** Long-press anywhere on any page for 1 second, drag to select a region, and ask AI about what you see. No copy-pasting, no screenshots to clipboard, no switching to ChatGPT.

| | Dobby AI | HARPA AI | Merlin | Monica | Sider |
|---|:---:|:---:|:---:|:---:|:---:|
| **Screenshot & Ask AI** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Inline AI Responses** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Smart Content Detection** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Language-Aware Responses** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **No Account Required** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Open Source** | ✅ | ❌ | ❌ | ❌ | ❌ |

## Features

### Visual Intelligence
- **Screenshot any region** — long-press 1s anywhere, drag to select, ask AI about charts, diagrams, UI designs, error screenshots, math equations, or anything on screen
- **Right-click any image** — ask AI about it directly via context menu
- **Image selection** — select text that contains images and both text + images are sent to AI

### Text Intelligence
- **Inline AI responses** — frosted glass bubble right next to your selection, no tab-switching
- **Streaming responses** — see the AI's answer as it's generated, with live markdown rendering
- **Smart content detection** — automatically detects code, errors, math, emails, data, foreign languages and suggests relevant presets
- **Language-aware** — responds in the same language as your selected text
- **Follow-up conversations** — ask follow-up questions within the same bubble, with full chat history
- **Preset prompts** — one-click actions like "Explain", "Debug", "Summarize", "Translate"
- **Custom instructions** — click the pencil icon to type any prompt inline

![Custom prompt demo](https://raw.githubusercontent.com/Duobi-AI/dobby-ai/docs/pr-demo-gifs/toolbar-custom-prompt.gif)

### UX
- **Pin & drag** — pin the chat bubble and drag it anywhere on the page
- **Resize** — drag the corner handle to resize the bubble
- **Chat history** — browse and resume past conversations
- **Light/dark theme** — matches your OS preference
- **Shadow DOM isolation** — bubble UI won't conflict with page styles

## Quick Start

### Chrome Web Store

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/fobblgpebpnelefaneijkpbcljdlofoo?utm_source=item-share-cb) — one click and you're ready.

### Manual Installation

```bash
git clone https://github.com/Duobi-AI/dobby-ai.git
cd dobby-ai
npm install
npm run build
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked** → select the `dist` directory
4. Go to the extension's **Options** page to set your OpenAI API key (optional — 30 free questions/day without one)

## Usage

### Text Selection
```
Select text → Click floating trigger → Pick a preset → AI responds inline
```

### Screenshot Mode
```
Long-press 1s → Drag to select region → Capture → AI analyzes the image
```

### Context Menu
```
Right-click any image → "Dobby AI" → AI describes/analyzes the image
```

## Architecture

Built with vanilla JS, bundled with esbuild, no frameworks.

```
dobby-ai/
├── src/
│   ├── content/                    # Content script modules (bundled → dist/content.js)
│   │   ├── index.js                # Entry point — message listeners, init
│   │   ├── bubble/
│   │   │   ├── core.js             # Bubble UI — init, show/hide, presets
│   │   │   ├── stream.js           # Streaming responses, follow-up handling
│   │   │   ├── history.js          # Chat history panel
│   │   │   ├── markdown.js         # Markdown renderer with XSS protection
│   │   │   └── styles.js           # CSS-in-JS styles (Shadow DOM)
│   │   ├── trigger/
│   │   │   ├── button.js           # Floating trigger button on text selection
│   │   │   ├── screenshot.js       # Screenshot overlay, drag-to-select, toolbar
│   │   │   ├── progress-ring.js    # Long-press progress ring animation
│   │   │   └── selection.js        # Event listeners (mouseup, scroll, long-press)
│   │   ├── shared/
│   │   │   ├── state.js            # Centralized mutable state
│   │   │   ├── constants.js        # Z-index, theme colors, timing values
│   │   │   └── dom-utils.js        # DOM helpers
│   │   ├── detection.js            # Smart content type detection engine
│   │   ├── presets.js              # Preset prompts per content type
│   │   ├── prompt.js               # OpenAI message format builder
│   │   ├── api.js                  # Background service worker communication
│   │   ├── history.js              # Chat history storage (chrome.storage)
│   │   └── image-capture.js        # Screenshot capture, CORS refetch, downscaling
│   ├── background/
│   │   └── index.js                # Service worker — API relay, SSE streaming
│   ├── popup.js                    # Toolbar popup (enable/disable toggle)
│   └── options.js                  # Settings page (API key management)
├── dist/                           # Built output (load this in Chrome)
├── proxy/                          # Cloudflare Worker proxy server
├── tests/                          # Vitest test suite (400+ tests, 88% coverage)
├── esbuild.config.js               # Build config — src/ → dist/
└── manifest.json                   # Chrome extension manifest (MV3)
```

## Development

```bash
npm install           # Install dependencies
npm run build         # Build the extension → dist/
npm run dev           # Watch mode — auto-rebuilds on file changes
npm test              # Run tests
npm run test:watch    # Run tests in watch mode
```

After building, load `dist/` as an unpacked extension in Chrome. With `npm run dev`, the extension auto-rebuilds on file changes — just reload the extension in Chrome to pick up changes.

### Smart Detection

When you select text, the detection engine analyzes it to suggest relevant presets:

| Content Type | Detection | Example Presets |
|---|---|---|
| JavaScript | `const`, `let`, `=>`, `console.log` | "Explain this JavaScript", "Convert to TypeScript" |
| Python | `def`, `self`, `elif`, `True/False/None` | "Explain this Python", "Add type hints" |
| Rust | `fn`, `let mut`, `impl`, `println!` | "Explain this Rust", "Optimize" |
| Chinese/Japanese/Korean | Unicode character ranges | "Summarize", "Translate to English" |
| Error/Stack trace | `Error:`, `Traceback`, `at file:line` | "Explain error", "Suggest fix" |
| Email | `Dear`/`Hi` + `Regards`/`Best` | "Draft reply", "Summarize email" |
| Math formula | LaTeX patterns, math operators | "Solve this", "Explain formula" |
| Images | Screenshot or right-click | "Explain this image", "Extract text" |

### CI/CD

| Workflow | Purpose |
|----------|---------|
| `ci.yml` | Extension build/tests, proxy tests, manifest linting, Playwright E2E, and packaging on every push/PR |
| `coverage.yml` | PR coverage reporting with an 80% threshold |
| `security.yml` | Root and proxy `npm audit`, dangerous pattern scan, and manifest permission audit |
| `pr-preview.yml` | Built extension artifact from `dist/`, plus PR preview comment and permission diff |
| `permission-guard.yml` | Fails PRs that add extension permissions until they are reviewed |
| `auto-label.yml` | Applies PR labels based on changed files |
| `release.yml` | Tag-based build, GitHub Release, and Chrome Web Store publish |
| `version-bump.yml` | Manual version bump branch and release PR creation |
| `token-count.yml` | Updates the repository token-count badge |

E2E tests run inside `ci.yml`; there is no separate `e2e.yml` workflow.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Write tests for your changes
4. Run `npm run build && npm test` to verify
5. Submit a pull request

## Privacy

Dobby AI collects **zero data**. No accounts, no analytics, no cookies, no telemetry. Your selected text and screenshots are sent to the OpenAI API (directly with your key, or through a secure proxy) and never stored. See [PRIVACY.md](PRIVACY.md) for details.

## License

[MIT](LICENSE) — free and open source.

---

<p align="center">
  Built with a dislike for copy-pasting and tab-switching
</p>
