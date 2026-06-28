# SplitVision

## Overview

`SplitVision` includes the `splitscreen-extension` browser extension, branded as **SplitView — Multi-Tab Screen**. The extension captures browser tabs and displays them together in a customizable split-screen viewer with audio mixing, muting, soloing, and fullscreen controls.

## Repository structure

- `splitscreen-extension/`
  - `manifest.json` - extension metadata, permissions, background service worker, action popup, and web accessible resources.
  - `icons/` - extension icon assets used in browser UI.
  - `src/` - main extension source code and UI.
    - `background.js` - service worker logic that opens the viewer page, queries capturable tabs, and requests `tabCapture` streams.
    - `popup.html` - extension popup shown when clicking the toolbar button.
    - `popup.js` - popup script that opens the viewer tab.
    - `viewer.html` - main split-screen viewer UI for captured tab sources.
    - `viewer.js` - front-end behavior for layout selection, tab capture flow, stream attachment, audio control, mixer panel, and fullscreen display.
    - `viewer.css` - styling for the viewer UI.

## Key functionality

### Popup

- Provides a lightweight UI with a single button to open the full SplitView viewer.
- Calls the background script to open or activate the viewer tab.

### Background service worker (`background.js`)

- Listens for messages from the popup and viewer.
- Opens the viewer tab or activates it if already open.
- Returns the list of capturable tabs in the current window, excluding Chrome internal pages and the viewer tab itself.
- Triggers `chrome.tabCapture.getMediaStreamId` to capture the target tab's audio/video stream and restore focus.

### Viewer UI (`viewer.html`, `viewer.js`)

- Displays a canvas of up to 4 slots for captured tab sources.
- Supports multiple layouts: single, 2-side, 2-stack, 3-main/right/top, 4-grid, 4-main/right/top.
- Opens a tab picker modal to select a tab for capture.
- Attaches captured tab streams to video elements and routes audio through the Web Audio API.
- Provides audio controls per slot:
  - mute
  - solo
  - volume slider
  - live audio status indicators
- Includes a mixer panel to adjust master and per-source volume, plus visual VU meters.
- Supports fullscreen viewing of a selected source with audio status badge.

## Permissions and capabilities

- `tabCapture` - capture tab audio/video streams.
- `tabs` - query and manage tab data.
- `activeTab` - temporarily activate tabs during capture flow.
- `storage` - reserved for future storage usage.
- `host_permissions` `"<all_urls>"` - allow access to the viewer page and tab capture across all URLs.

## Loading the extension

1. Open Chrome/Edge and navigate to `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked` and select `splitscreen-extension/`.
4. Click the SplitView toolbar button to open the viewer.

## Notes

- The extension is built for Manifest V3.
- The viewer page is exposed as a web accessible resource so it can be opened from the extension action and background script.
- Audio is always routed through the Web Audio API, while video playback is rendered via muted `<video>` elements inside each slot.
