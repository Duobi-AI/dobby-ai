# Privacy Policy - Dobby AI Chrome Extension

**Last updated:** September 25, 2026

## Overview

Dobby AI is a Chrome extension that lets users select webpage text, capture selected webpage screenshots or images, and get AI-powered answers inline on the page. This policy explains what data the extension handles and how that data is used.

## Data Dobby AI Handles

Dobby AI handles data only when needed to provide user-facing extension features:

- **Website content:** selected webpage text, extracted current-tab context, selected images, screenshots, nearby page context for auto-suggest, and user-entered prompts.
- **Webpage metadata:** page title and URL may be included with selected-text answers, page context, or auto-suggest, and may be saved with local conversation history.
- **Authentication information:** if you choose to use your own OpenAI API key, the key is stored locally in Chrome extension storage and used only to send your requests to OpenAI.
- **Extension settings and usage state:** preferences, feature toggles, local usage counters, and local conversation history are stored with Chrome's local extension storage.

Dobby AI does not collect names, email addresses, payment information, health information, precise location, advertising identifiers, or cookies. Dobby AI collects the limited usage telemetry described below as part of operating the service.

## Usage Telemetry

Dobby AI sends an anonymous usage event for each tracked request containing:

- whether the request used the Dobby AI free proxy or the user's own API key;
- a randomly generated installation identifier that is not an account identifier; and
- the extension version.

This telemetry also identifies the request kind (Chat, Autosuggestion, or screenshot capture) and final outcome (success, provider error, timeout, or rate limit). Its payload contains no API keys, prompts, webpage content, URLs, screenshots, model responses, or conversation history. It is used only for product capacity and reliability measurement. For requests handled by the Dobby AI proxy, source IP and aggregate request metadata are recorded separately in structured Worker logs, as described below. Cloudflare may process standard network metadata according to its terms and privacy policy.

For requests handled by the Dobby AI proxy, its structured Cloudflare Worker logs also record the source IP address, route, feature purpose, request outcome, country and network ASN when available, extension version and random installation identifier for telemetry events, and aggregate request-shape counts (serialized body character count, message count, user-text character count, and image count). These counts do not include message text or image data. The logs do not record prompts, webpage content or URLs, image bytes, API keys, access tokens, signatures, or model responses. This information is used for capacity planning, reliability troubleshooting, rate limiting, and abuse prevention. Cloudflare stores Worker logs according to the account plan's log-retention policy.

## How Data Is Used

Dobby AI uses handled data only to provide or improve its single purpose: answering user-selected webpage content and assisting with user-initiated writing.

- Selected text, extracted current-tab context, screenshots, images, prompts, and auto-suggest context are sent to an AI model so the model can generate the requested answer or suggestion.
- Current-tab context extraction is local and attempts to prioritize useful page information such as headings, nearby selected-text context, and main content while excluding common page chrome and editable/form fields such as navigation, footers, inputs, textareas, and contenteditable regions.
- If you provide your own OpenAI API key, requests are sent directly from the extension to the OpenAI API over HTTPS.
- If you do not provide your own API key, requests are relayed through the Dobby AI proxy over HTTPS and then sent to OpenAI. The proxy relays requests and responses for the feature and does not store prompt content or model responses.
- The extension sends the limited usage event described above to the Dobby AI proxy. The proxy records the event in its structured observability logs and does not write it to the rate-limit KV namespace. Proxy request logs include the source IP and aggregate request-shape counts described above, but no request content or credentials.
- Local conversation history is stored only in your browser and can be cleared from the extension popup.
- Local usage counters are used only to show request counts and free-tier status in the extension popup.

## Data Sharing

Dobby AI does not sell user data and does not transfer user data for advertising, data brokerage, creditworthiness, lending, or unrelated purposes.

Data may be processed by the following services only as needed to provide the extension's AI features:

- **OpenAI API:** processes selected content, prompts, images, screenshots, extracted current-tab context, and auto-suggest context to generate AI responses.
- **Cloudflare Workers:** hosts the Dobby AI proxy used when a user does not provide their own OpenAI API key.

These services process data according to their own terms and privacy policies.

## Retention and Controls

- Your OpenAI API key, settings, usage counters, and conversation history are stored locally in your browser.
- Conversation history is limited to recent conversations and can be cleared from the extension popup.
- Extracted current-tab context is cached only in memory for a short time while the page is open and is not written to Chrome storage by Dobby.
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
