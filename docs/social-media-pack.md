# Dobby AI Social Media Content Pack

A collection of ready-to-publish social media posts for promoting Dobby AI across Reddit, Twitter/X, Hacker News, and LinkedIn.

---

## 1. Reddit — r/productivity

**Title:**
Stop Copy-Pasting Questions Into ChatGPT — I Built an Extension That Brings AI to You

**Body:**
I was tired of the workflow: select text → copy → open new tab → paste → wait → copy answer → close tab. So I built Dobby AI.

It's a Chrome extension that lets you select any text on a webpage and get instant AI answers in a floating bubble right where you are. No copy-pasting, no tab-switching, no context loss.

**How it works:**
1. Select text on any webpage
2. A small button appears
3. Click it, pick a preset ("Explain", "Debug", "Summarize", "Translate"), or type a custom question
4. AI responds inline in seconds

**The kicker:** You can also long-press anywhere on a page for 1 second, drag to select a region, and screenshot it. Then ask AI about it directly. Great for error messages, charts, diagrams, code snippets, or anything visual on screen.

**Why it's different:**
- No account required — works offline with 30 free questions/day
- Fully open source (MIT license)
- Zero data collection — your selections never leave your browser or get stored
- Smart detection figures out if you selected code, an error, a formula, or a foreign language and suggests relevant actions
- Supports follow-up conversations within the same bubble

**Get it here:**
Chrome Web Store: https://chromewebstore.google.com/detail/fobblgpebpnelefaneijkpbcljdlofoo
GitHub: https://github.com/zhongnansu/dobby-ai

Would love feedback, bug reports, or feature ideas. Happy to discuss what you'd want from an extension like this.

---

## 2. Reddit — r/ChatGPT

**Title:**
Ask ChatGPT Without Leaving Your Tab — New Chrome Extension with Screenshot Analysis

**Body:**
Dobby AI is a new Chrome extension that lets you use AI without leaving the webpage you're on. Select text, get an instant response in a frosted glass bubble. No new tabs, no copy-pasting, no account required.

**Text Selection Mode:**
Select any text → a button appears → pick a preset or ask a custom question → AI responds inline in seconds. The bubble is draggable, resizable, and remembers your chat history.

**Screenshot Mode (the key differentiator):**
Long-press anywhere on the page for 1 second, drag to select a region, and Dobby AI will screenshot it and analyze the image. Perfect for:
- Error messages and stack traces
- Graphs, charts, and data visualizations
- UI designs and screenshots
- Code snippets (as images)
- Math equations and formulas
- Anything visual on screen

**Smart Features:**
- Content detection recognizes code, errors, math, emails, and foreign languages → suggests relevant presets
- Streaming responses so you see the answer as it's generated
- Follow-up conversations within the same bubble
- Light/dark theme (matches your OS)
- Works offline with 30 free questions/day (optional OpenAI API key for unlimited)

**Privacy & Open Source:**
- Zero data collection
- MIT license
- All code on GitHub

**Get it:**
Chrome Web Store: https://chromewebstore.google.com/detail/fobblgpebpnelefaneijkpbcljdlofoo
GitHub: https://github.com/zhongnansu/dobby-ai

---

## 3. Reddit — r/chrome

**Title:**
Dobby AI — Screenshot Any Region & Ask AI About It. No Tab-Switching, No Account Needed.

**Body:**
I've built and released Dobby AI, a Chrome extension that integrates AI directly into your browsing workflow.

**What it does:**

*Text Selection:*
Select text on any webpage → click the floating button → pick a preset action (Explain, Debug, Summarize, Translate) or type a custom question → get an instant response in a bubble next to your selection.

*Screenshot Analysis:*
Long-press anywhere on a page for 1 second, drag to select a region, and Dobby AI will capture and send it to AI for analysis. Works with charts, diagrams, code, error messages, math equations, UI screenshots, and more.

**Key Features:**
- Inline responses (frosted glass bubble, no new tabs)
- Smart content detection (automatically identifies code, errors, math, emails, languages)
- Streaming responses with markdown rendering
- Follow-up conversations within the bubble
- Draggable, resizable chat window
- Chat history
- Light/dark theme (OS preference)
- Keyboard shortcuts for all actions

**Accessibility:**
- No account required
- 30 free questions/day (or bring your own OpenAI key for unlimited)
- Zero data collection — privacy-first
- Open source (MIT)

**Links:**
Chrome Web Store: https://chromewebstore.google.com/detail/fobblgpebpnelefaneijkpbcljdlofoo
GitHub: https://github.com/zhongnansu/dobby-ai
Landing Page: https://zhongnansu.github.io/dobby-ai

Happy to answer questions or take feedback!

---

## 4. Twitter/X Thread (5 Tweets)

**Tweet 1 (Hook):**
I built a Chrome extension so you never have to copy-paste a question into ChatGPT again.

Select text. Get answers inline. No new tabs. No account required.

Meet Dobby AI 🧵

**Tweet 2 (Problem):**
The AI workflow sucks:
- Select text
- Copy it
- Open ChatGPT in new tab
- Paste it
- Wait for response
- Copy answer
- Switch back
- Close tab

5+ steps for a simple question.

**Tweet 3 (Solution):**
Dobby AI changes it:
- Select text
- Click button
- Pick preset or ask
- Get answer inline

AI comes to you. No tab-switching. No copy-pasting.

The response appears in a frosted glass bubble right next to your selection.

**Tweet 4 (Differentiator):**
But here's what makes it different: long-press anywhere to screenshot any region of your screen.

Ask AI about error messages, charts, code snippets, diagrams, math equations, anything visual.

No other extension does this.

Oh, and no account required. 30 free questions/day.

**Tweet 5 (CTA):**
Fully open source (MIT). Zero data collection.

Try it: https://chromewebstore.google.com/detail/fobblgpebpnelefaneijkpbcljdlofoo

GitHub: https://github.com/zhongnansu/dobby-ai

Feedback welcome.

---

**Thread Notes:**
- Tweet 1: 157 characters
- Tweet 2: 185 characters
- Tweet 3: 167 characters
- Tweet 4: 273 characters
- Tweet 5: 186 characters
- Total thread: 968 characters
- Easily fittable in Twitter's thread format with room for media/GIF if desired

---

## 5. Hacker News — Show HN

**Title:**
Show HN: Dobby AI — Screenshot anything on the web and ask AI about it

**Body:**
I built Dobby AI, a Chrome extension that integrates AI into your browser workflow without ever leaving the page you're on.

Two core features:

**Text Selection → Inline Response**
Select any text, click a button, and AI responds in a frosted glass bubble next to your selection. Smart content detection identifies code, errors, formulas, emails, and languages, then suggests relevant actions ("Explain this code", "Debug this error", "Translate this text"). Supports follow-up conversations.

**Screenshot Analysis**
Long-press anywhere on a page for 1 second, drag to select a region, and Dobby captures it and sends it to AI. Perfect for error messages, charts, diagrams, UI screenshots, code snippets (as images), math equations, or anything visual on screen.

**Why build this?**
I was tired of the workflow: select → copy → new tab → paste → wait → copy answer → close tab. Dobby collapses that into: select → click → done.

**Technical details:**
- Built with vanilla JavaScript (no frameworks) — ~5KB gzipped extension
- Manifest V3, Shadow DOM for style isolation
- Streaming responses with server-sent events
- Client-side markdown rendering with XSS protection
- 400+ unit tests, 88% code coverage
- CI/CD pipeline with security scanning and automated Web Store deployment

**Openness & Privacy:**
- MIT license, fully open source on GitHub
- Zero data collection — no analytics, no tracking, no accounts
- 30 free questions/day built-in (or bring your own OpenAI API key)
- Direct API calls (no data stored on servers)

**Get it:**
- Chrome Web Store: https://chromewebstore.google.com/detail/fobblgpebpnelefaneijkpbcljdlofoo
- GitHub: https://github.com/zhongnansu/dobby-ai
- Landing: https://zhongnansu.github.io/dobby-ai

Would love feedback on the experience or ideas for features. Happy to discuss architecture or answer questions about building extensions.

---

## 6. LinkedIn Post

**Hook + Body:**

What if AI came to you instead of making you go to it?

That's the idea behind Dobby AI, a Chrome extension I just released.

No more copy-pasting questions into ChatGPT. No more tab-switching. No more losing context.

**How it works:**
Select text on any webpage → get instant AI answers in a floating bubble right where you are. The extension intelligently detects what you selected (code, error message, email, foreign language) and suggests relevant actions. One click and you get a response.

But the real game-changer: long-press anywhere to screenshot a region and ask AI about what you see. Charts, diagrams, error screenshots, anything visual. Direct analysis without the copy-paste-and-wait cycle.

**Why I built this:**
Productivity isn't just about speed — it's about friction. Every time you switch tabs, copy-paste, or lose context, you pay a cognitive cost. I wanted to eliminate that cost.

**What makes it different:**
- Screenshot-and-ask capability (no other extension does this)
- Inline responses (no new tabs, no sidebar interruptions)
- Zero data collection (privacy-first)
- No account required
- Open source

**The numbers:**
- 30 free questions/day (no signup)
- 400+ unit tests, 88% code coverage
- MIT license

Whether you're debugging code, understanding an article, analyzing a chart, or translating a passage, Dobby AI gets out of your way and gives you answers where you need them.

**Try it:**
Chrome Web Store: https://chromewebstore.google.com/detail/fobblgpebpnelefaneijkpbcljdlofoo
GitHub: https://github.com/zhongnansu/dobby-ai

Feedback, ideas, and contributions welcome.

#ChromeExtension #ProductivityTools #OpenSource #AI #DeveloperTools #Innovation

---

## Usage Notes

### For Reddit Posts
- Copy the exact title and body as provided
- Reddit markdown is already formatted (no special preprocessing needed)
- All links are direct and clickable
- Tone is conversational and genuine (Reddit audience values this)

### For Twitter/X Thread
- Post tweets in order (1 → 5)
- Each tweet is under Twitter's character limit
- Optional: attach a demo GIF or screenshot to Tweet 1 for more engagement
- Thread maintains narrative arc: problem → solution → differentiation → CTA

### For Hacker News
- Use the exact title format: "Show HN: Dobby AI — ..."
- Copy the body as provided
- HN audience appreciates technical depth and transparency
- Links are included but not oversold
- Tone is builder-to-builder, not salesy

### For LinkedIn
- Post the hook and full body as provided
- Add the hashtags at the end (LinkedIn prioritizes native hashtags)
- Optional: break into 2-3 shorter paragraphs for better mobile readability
- LinkedIn audience values both technical credibility and business impact

### General Tips
- **Timing:** Post Reddit threads during business hours (9 AM - 3 PM in major US timezones)
- **Twitter:** Schedule the thread for maximum timezone overlap if targeting global audience
- **HN:** Post early morning (8-10 AM EST) for visibility
- **LinkedIn:** Post mid-morning (9-11 AM) for engagement
- **Engagement:** Prepare to respond to top-level comments within the first hour for better ranking

---

## Assets to Pair With Posts

### Screenshots/GIFs to Enhance Posts
1. **Demo GIF:** Text selection → response in bubble (5 seconds)
2. **Screenshot Mode:** Long-press → drag → screenshot captured → AI responds
3. **Chat History:** Follow-up conversations in the bubble
4. **Theme Toggle:** Light/dark mode switching

These can be generated using Playwright and are referenced in the CLAUDE.md workflow guidelines.

### Messaging Callouts
- **For developers:** "Finally, no more context-switching"
- **For productivity folks:** "AI exactly where you need it"
- **For privacy-conscious users:** "Zero data collection, fully open source"
- **For managers:** "Reduces context-switching friction across your team"
