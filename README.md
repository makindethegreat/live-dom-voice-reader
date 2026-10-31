# Live DOM Voice Reader

A lightweight Chrome Manifest V3 extension that reads the main text content of the current webpage aloud using the browser's native speech synthesis engine.

It does not use a remote text-to-speech service, send page content to a server, or require an account.

## Features

- Reads visible page content in document order: paragraphs, headings (H1–H4), list items, blockquotes, and article content.
- Skips hidden elements and common page chrome such as navigation, headers, footers, and sidebars.
- Highlights and scrolls to the block currently being read.
- Uses voices installed in the browser or operating system through `window.speechSynthesis`.
- Provides Play, Pause, Resume (through Play while paused), and Stop controls.
- Injects the content script on demand and guards against duplicate initialization.

## Project files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 metadata and minimum permissions |
| `content.js` | Page text extraction, highlighting, speech playback, and message handling |
| `popup.html` | Compact popup interface |
| `popup.js` | Active-tab setup, voice selection, and playback controls |

## Installation in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the project folder containing `manifest.json`.
6. Open a regular webpage, select the extension icon, choose a voice, and press **Play**.

## Installation in Microsoft Edge or Brave

The extension is compatible with Chromium-based browsers.

- **Microsoft Edge:** open `edge://extensions`, enable Developer mode, and select **Load unpacked**.
- **Brave:** open `brave://extensions`, enable Developer mode, and select **Load unpacked**.

Choose the same project folder containing `manifest.json`.

## How to use

1. Navigate to an article or other webpage.
2. Open the extension popup.
3. Choose an available voice from the dropdown. If no voice is selected, the browser's default voice is used.
4. Select **Play** to start reading.
5. Select **Pause** to pause. Select **Play** again to resume.
6. Select **Stop** to cancel playback and clear the current highlight.

The reader starts from the beginning each time a stopped session is played again.

## Permissions

The extension requests only:

- `activeTab`: access to the active tab after the user invokes the extension.
- `scripting`: inject `content.js` into that active tab when the popup opens.

It does not request broad host permissions, persistent background access, storage, or network access. Speech synthesis is provided by the browser and operating system.

## Troubleshooting

**The popup says the page cannot be read**

Chrome restricts extension injection on certain pages, including browser-internal pages (such as `chrome://extensions`), the Chrome Web Store, and some built-in document viewers. Navigate to a normal website and try again.

**No voices appear in the dropdown**

Available voices depend on the browser and operating system. Check the operating system's text-to-speech or accessibility settings, then reopen the popup. Some browsers populate their voice list after a short delay.

**The reader skips some text**

The reader intentionally ignores hidden content and common navigation or layout regions. It extracts supported semantic elements; text rendered only inside images, canvas elements, embedded documents, or inaccessible frames is not available to the page script.

**Speech does not start**

Check that the tab is not muted and that the browser or operating system has an available speech voice. Try another voice from the dropdown.

**The extension does not reflect a code change**

After editing extension files, open `chrome://extensions` (or the equivalent page in your browser) and select **Reload** on the extension card. Refresh the webpage as well.

## Browser compatibility

Designed for current Chromium-based browsers that support Manifest V3, the Extensions Scripting API, and the Web Speech API (`SpeechSynthesis`).

## Privacy

All page extraction and speech playback happen locally in the browser. This project contains no analytics, tracking, external scripts, or remote API calls.
