let viewerTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'OPEN_VIEWER') {
    openViewer().then(result => {
      viewerTabId = result.tabId;
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'GET_TABS') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const filtered = tabs.filter(t =>
        t.id !== viewerTabId &&
        t.url &&
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://') &&
        !t.url.startsWith('about:')
      );
      sendResponse({
        tabs: filtered.map(t => ({
          id: t.id,
          title: t.title,
          url: t.url,
          favIconUrl: t.favIconUrl,
        })),
      });
    });
    return true;
  }

  // Use desktopCapture instead of tabCapture — no activeTab restriction,
  // works from any context, shows Chrome's native source picker.
  if (msg.type === 'CAPTURE_DESKTOP') {
    const sources = ['tab'];   // restrict picker to tabs only
    const reqId = chrome.desktopCapture.chooseDesktopMedia(
      sources,
      // Pass the viewer tab as the requesting tab so the picker appears there
      sender.tab || null,
      (streamId, options) => {
        if (!streamId) {
          sendResponse({ error: 'User cancelled or capture unavailable.' });
        } else {
          sendResponse({ streamId, options });
        }
      }
    );
    // If caller needs to cancel (e.g. modal closed), they can send CANCEL_CAPTURE
    // Store reqId keyed by sender tab
    if (sender.tab) pendingCaptures.set(sender.tab.id, reqId);
    return true;
  }

  if (msg.type === 'CANCEL_CAPTURE') {
    const reqId = pendingCaptures.get(sender.tab && sender.tab.id);
    if (reqId != null) {
      chrome.desktopCapture.cancelChooseDesktopMedia(reqId);
      pendingCaptures.delete(sender.tab.id);
    }
    sendResponse({ ok: true });
    return true;
  }

});

const pendingCaptures = new Map();

async function openViewer() {
  const url = chrome.runtime.getURL('src/viewer.html');
  const existing = await chrome.tabs.query({ url });
  if (existing.length > 0) {
    await chrome.tabs.update(existing[0].id, { active: true });
    viewerTabId = existing[0].id;
    return { tabId: existing[0].id };
  }
  const tab = await chrome.tabs.create({ url });
  viewerTabId = tab.id;
  return { tabId: tab.id };
}
