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

  if (msg.type === 'CAPTURE_TAB') {
    captureTab(msg.tabId, msg.viewerTabId, sendResponse);
    return true;
  }
});

// Capture strategy:
// 1. Temporarily focus the target tab so the extension is "active" on it
// 2. Call tabCapture.getMediaStreamId with no targetTabId (captures active tab)
//    but pass consumerTabId = viewer tab so the stream can be consumed there
// 3. Restore focus back to the viewer tab
async function captureTab(tabId, consumerTabId, sendResponse) {
  const effectiveConsumer = consumerTabId || viewerTabId;

  try {
    // Store which tab was active before we switch
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Focus the target tab briefly so tabCapture can act on it
    await chrome.tabs.update(tabId, { active: true });

    // Small yield to let Chrome register the tab switch
    await new Promise(r => setTimeout(r, 80));

    // Now get the stream id — targeting the now-active tab
    chrome.tabCapture.getMediaStreamId(
      { consumerTabId: effectiveConsumer },
      async (streamId) => {
        const err = chrome.runtime.lastError;

        // Restore focus to the viewer (or previous active tab)
        const restoreId = effectiveConsumer || (activeTab && activeTab.id);
        if (restoreId) {
          await chrome.tabs.update(restoreId, { active: true }).catch(() => {});
        }

        if (err || !streamId) {
          sendResponse({ error: err ? err.message : 'No stream ID returned' });
        } else {
          sendResponse({ streamId });
        }
      }
    );
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

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
