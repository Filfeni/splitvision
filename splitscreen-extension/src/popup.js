document.getElementById('openBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_VIEWER' }, () => {
    window.close();
  });
});
