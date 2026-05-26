# Privacy Policy - Dobby AI Chrome Extension

**Last updated:** May 26, 2026

## Overview

Dobby AI is a Chrome extension that lets users select webpage text, capture selected webpage screenshots or images, and get AI-powered answers inline on the page. This policy explains what data the extension handles and how that data is used.

## Data Dobby AI Handles

Dobby AI handles data only when needed to provide user-facing extension features:

- **Website content:** selected webpage text, selected images, screenshots, nearby page context for auto-suggest, and user-entered prompts.
- **Webpage metadata:** page title and URL may be included when page context or auto-suggest is enabled, and may be saved with local conversation history.
- **Authentication information:** if you choose to use your own OpenAI API key, the key is stored locally in Chrome extension storage and used only to send your requests to OpenAI.
- **Extension settings and usage state:** preferences, feature toggles, local usage counters, and local conversation history are stored with Chrome's local extension storage.

Dobby AI does not collect names, email addresses, payment information, health information, precise location, analytics, telemetry, advertising identifiers, or cookies.

## How Data Is Used

Dobby AI uses handled data only to provide or improve its single purpose: answering user-selected webpage content and assisting with user-initiated writing.

- Selected text, screenshots, images, prompts, and optional page context are sent to an AI model so the model can generate the requested answer or suggestion.
- If you provide your own OpenAI API key, requests are sent directly from the extension to the OpenAI API over HTTPS.
- If you do not provide your own API key, requests are relayed through the Dobby AI proxy over HTTPS and then sent to OpenAI. The proxy relays requests and responses for the feature and does not store prompt content or model responses.
- Local conversation history is stored only in your browser and can be cleared from the extension popup.
- Local usage counters are used only to show request counts and free-tier status in the extension popup.

## Data Sharing

Dobby AI does not sell user data and does not transfer user data for advertising, data brokerage, creditworthiness, lending, or unrelated purposes.

Data may be processed by the following services only as needed to provide the extension's AI features:

- **OpenAI API:** processes selected content, prompts, images, screenshots, and optional page context to generate AI responses.
- **Cloudflare Workers:** hosts the Dobby AI proxy used when a user does not provide their own OpenAI API key.

These services process data according to their own terms and privacy policies.

## Retention and Controls

- Your OpenAI API key, settings, usage counters, and conversation history are stored locally in your browser.
- Conversation history is limited to recent conversations and can be cleared from the extension popup.
- Your OpenAI API key can be removed from the extension settings page.
- Removing the extension removes its local extension storage from Chrome.

## Permissions

- **contextMenus:** adds Dobby AI actions to the right-click menu.
- **activeTab:** captures a visible tab screenshot only after an explicit user gesture.
- **storage:** stores local settings, API key, usage counters, and conversation history.
- **notifications:** informs users when the extension cannot run on restricted pages.
- **host permissions:** allow the content script to provide inline tools on webpages and allow secure requests to the Dobby AI proxy and OpenAI API.

## Chrome Web Store Limited Use

Dobby AI's use and transfer of user data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. User data is used only to provide or improve the extension's single purpose and user-facing features.

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/Duobi-AI/dobby-ai/issues
