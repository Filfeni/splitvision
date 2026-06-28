'use strict';

const MAX_SOURCES = 4;

// ── State ───────────────────────────────────────────────────────
const state = {
  slots: [null, null, null, null],
  // each slot when active: { tabId, title, stream, videoEl, gainNode, sourceNode, analyserNode, volume, muted, solo }
  layout: '4-grid',
  pendingSlotIndex: null,
  selectedTabId: null,
  soloIndex: null,           // which slot is soloed (null = none)
  masterVolume: 1.0,
  audioCtx: null,
  masterGain: null,
  mixerOpen: false,
  fullscreenIndex: null,
  vuAnimFrame: null,
};

// ── DOM refs ────────────────────────────────────────────────────
const canvas        = document.getElementById('canvas');
const canvasEmpty   = document.getElementById('canvas-empty');
const addBtn        = document.getElementById('add-source-btn');
const statusCount   = document.getElementById('status-count');
const statusLayout  = document.getElementById('status-layout');
const statusAudio   = document.getElementById('status-audio');
const mixerToggle   = document.getElementById('mixer-toggle-btn');
const mixerPanel    = document.getElementById('mixer-panel');
const mixerChannels = document.getElementById('mixer-channels');
const masterVolEl   = document.getElementById('master-vol');
const masterVolVal  = document.getElementById('master-vol-val');
const modalOverlay  = document.getElementById('modal-overlay');
const tabList       = document.getElementById('tab-list');
const modalConfirm  = document.getElementById('modal-confirm-btn');
const modalCancel   = document.getElementById('modal-cancel-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const fsOverlay     = document.getElementById('fullscreen-overlay');
const fsVideo       = document.getElementById('fs-video');
const fsLabel       = document.getElementById('fs-label');
const fsAudioBadge  = document.getElementById('fs-audio-badge');
const fsCloseBtn    = document.getElementById('fs-close-btn');

// ── Audio context ───────────────────────────────────────────────
function ensureAudioCtx() {
  if (state.audioCtx) return;
  state.audioCtx = new AudioContext();
  state.masterGain = state.audioCtx.createGain();
  state.masterGain.gain.value = state.masterVolume;
  state.masterGain.connect(state.audioCtx.destination);
}

// ── Init ────────────────────────────────────────────────────────
function init() {
  buildSlots();
  bindLayoutButtons();
  bindAddButton();
  bindModal();
  bindMixer();
  bindFullscreen();
  updateUI();
}

// ── Slots ────────────────────────────────────────────────────────
function buildSlots() {
  canvas.innerHTML = '';
  for (let i = 0; i < MAX_SOURCES; i++) {
    canvas.appendChild(createSlotEl(i));
  }
}

function createSlotEl(index) {
  const div = document.createElement('div');
  div.className = 'slot';
  div.dataset.index = index;

  div.innerHTML = `
    <div class="slot-empty">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="6" width="28" height="20" rx="3"/>
        <line x1="10" y1="28" x2="22" y2="28"/>
        <line x1="16" y1="26" x2="16" y2="28"/>
      </svg>
      <span>Slot ${index + 1}</span>
    </div>

    <div class="slot-overlay">
      <span class="slot-label" id="label-${index}">–</span>
      <div class="slot-controls">
        <!-- Fullscreen -->
        <button class="slot-ctrl-btn fullscreen" title="Fullscreen (F)" data-index="${index}">
          <svg viewBox="0 0 14 14"><polyline points="1,4 1,1 4,1"/><polyline points="10,1 13,1 13,4"/><polyline points="13,10 13,13 10,13"/><polyline points="4,13 1,13 1,10"/></svg>
        </button>
        <!-- Solo audio -->
        <button class="slot-ctrl-btn audio-solo" title="Solo audio" data-index="${index}">
          <svg viewBox="0 0 14 14"><path d="M3 5v4h2.5l3.5 3V2L5.5 5H3z"/><path d="M10 4.5a3 3 0 0 1 0 5"/></svg>
        </button>
        <!-- Mute audio -->
        <button class="slot-ctrl-btn audio-mute" title="Mute audio" data-index="${index}">
          <svg viewBox="0 0 14 14"><path d="M3 5v4h2.5l3.5 3V2L5.5 5H3z"/><line x1="11" y1="4" x2="13" y2="6"/><line x1="13" y1="4" x2="11" y2="6"/></svg>
        </button>
        <!-- Swap -->
        <button class="slot-ctrl-btn swap" title="Change source" data-index="${index}">
          <svg viewBox="0 0 14 14"><path d="M1 7h12M9 3l4 4-4 4"/></svg>
        </button>
        <!-- Remove -->
        <button class="slot-ctrl-btn remove" title="Remove source" data-index="${index}">
          <svg viewBox="0 0 14 14"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>
        </button>
      </div>
    </div>

    <div class="slot-audio-pill" id="audio-pill-${index}">
      <div class="pill-dot"></div>
      <span class="pill-text">Live</span>
    </div>
    <div class="slot-num">${index + 1}</div>
  `;

  // Click empty area → add
  div.addEventListener('click', (e) => {
    if (e.target.closest('.slot-ctrl-btn')) return;
    if (!state.slots[index]) openModal(index);
  });

  div.querySelector('.slot-ctrl-btn.fullscreen').addEventListener('click', e => {
    e.stopPropagation(); openFullscreen(index);
  });
  div.querySelector('.slot-ctrl-btn.audio-solo').addEventListener('click', e => {
    e.stopPropagation(); toggleSolo(index);
  });
  div.querySelector('.slot-ctrl-btn.audio-mute').addEventListener('click', e => {
    e.stopPropagation(); toggleMute(index);
  });
  div.querySelector('.slot-ctrl-btn.swap').addEventListener('click', e => {
    e.stopPropagation(); openModal(index);
  });
  div.querySelector('.slot-ctrl-btn.remove').addEventListener('click', e => {
    e.stopPropagation(); removeSource(index);
  });

  return div;
}

// ── Layout ────────────────────────────────────────────────────────
function bindLayoutButtons() {
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => setLayout(btn.dataset.layout));
  });
}

function setLayout(layout) {
  state.layout = layout;
  canvas.dataset.layout = layout;
  document.querySelectorAll('.layout-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.layout === layout);
  });
  statusLayout.textContent = `Layout: ${layout}`;
}

// ── Add source ───────────────────────────────────────────────────
function bindAddButton() {
  addBtn.addEventListener('click', () => {
    const freeSlot = state.slots.findIndex(s => s === null);
    if (freeSlot !== -1) openModal(freeSlot);
  });
}

function updateAddButton() {
  addBtn.disabled = state.slots.filter(Boolean).length >= MAX_SOURCES;
}

// ── Modal ────────────────────────────────────────────────────────
function bindModal() {
  modalCancel.addEventListener('click', closeModal);
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  modalConfirm.addEventListener('click', confirmCapture);
}

function openModal(slotIndex) {
  state.pendingSlotIndex = slotIndex;
  state.selectedTabId = null;
  modalConfirm.disabled = true;
  modalOverlay.classList.add('open');
  loadTabs();
}

function closeModal() {
  modalOverlay.classList.remove('open');
  state.pendingSlotIndex = null;
  state.selectedTabId = null;
}

function loadTabs() {
  tabList.innerHTML = '<p style="color:#5a5a6e;font-size:13px;padding:8px 4px;">Loading tabs…</p>';
  chrome.runtime.sendMessage({ type: 'GET_TABS' }, ({ tabs }) => {
    if (!tabs || tabs.length === 0) {
      tabList.innerHTML = '<p style="color:#5a5a6e;font-size:13px;padding:8px 4px;">No capturable tabs found.</p>';
      return;
    }
    tabList.innerHTML = '';
    const capturedIds = state.slots.filter(Boolean).map(s => s.tabId);
    tabs.forEach(tab => {
      const already = capturedIds.includes(tab.id);
      const item = document.createElement('div');
      item.className = 'tab-item' + (already ? ' already' : '');
      item.dataset.tabId = tab.id;

      const faviconHtml = tab.favIconUrl
        ? `<img class="tab-favicon" src="${escHtml(tab.favIconUrl)}" alt="" onerror="this.style.display='none'">`
        : `<div class="tab-favicon-fallback">T</div>`;

      item.innerHTML = `
        ${faviconHtml}
        <div class="tab-info">
          <div class="tab-title">${escHtml(tab.title || 'Untitled')}</div>
          <div class="tab-url">${escHtml(truncateUrl(tab.url))}</div>
        </div>
        ${already ? '<span class="tab-badge">Captured</span>' : ''}
      `;

      if (!already) {
        item.addEventListener('click', () => {
          document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          state.selectedTabId = tab.id;
          modalConfirm.disabled = false;
        });
      }
      tabList.appendChild(item);
    });
  });
}

async function confirmCapture() {
  if (!state.selectedTabId || state.pendingSlotIndex === null) return;
  modalConfirm.disabled = true;
  modalConfirm.textContent = 'Capturing…';

  const tabId = state.selectedTabId;
  const slotIndex = state.pendingSlotIndex;

  chrome.runtime.sendMessage({ type: 'CAPTURE_TAB', tabId, viewerTabId: viewerOwnTabId }, async ({ streamId, error }) => {
    if (error) {
      alert('Capture failed: ' + error);
      modalConfirm.disabled = false;
      modalConfirm.textContent = 'Capture tab';
      return;
    }
    try {
      // Request BOTH audio and video
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
        audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      });

      chrome.tabs.get(tabId, (tab) => {
        attachStream(slotIndex, tabId, tab ? tab.title : `Tab ${tabId}`, stream);
      });

      closeModal();
      modalConfirm.textContent = 'Capture tab';
    } catch (err) {
      // Fallback: try video-only if audio fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
          audio: false,
        });
        chrome.tabs.get(tabId, (tab) => {
          attachStream(slotIndex, tabId, tab ? tab.title : `Tab ${tabId}`, stream, true);
        });
        closeModal();
        modalConfirm.textContent = 'Capture tab';
      } catch (err2) {
        alert('Capture failed: ' + err2.message);
        modalConfirm.disabled = false;
        modalConfirm.textContent = 'Capture tab';
      }
    }
  });
}

// ── Stream management ─────────────────────────────────────────────
function attachStream(slotIndex, tabId, title, stream, noAudio = false) {
  if (state.slots[slotIndex]) stopStream(slotIndex);

  ensureAudioCtx();

  const slotEl = canvas.querySelector(`.slot[data-index="${slotIndex}"]`);
  slotEl.querySelector('.slot-empty').style.display = 'none';

  // Video element — muted because audio goes through Web Audio
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;   // Always muted: audio routed via AudioContext
  video.playsInline = true;
  video.srcObject = stream;
  slotEl.insertBefore(video, slotEl.firstChild);

  // Audio routing via Web Audio API
  let gainNode = null, sourceNode = null, analyserNode = null;
  const hasAudio = !noAudio && stream.getAudioTracks().length > 0;

  if (hasAudio) {
    sourceNode   = state.audioCtx.createMediaStreamSource(stream);
    gainNode     = state.audioCtx.createGain();
    analyserNode = state.audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.6;

    gainNode.gain.value = 1.0;
    sourceNode.connect(gainNode);
    gainNode.connect(analyserNode);
    analyserNode.connect(state.masterGain);
  }

  const labelEl = slotEl.querySelector(`#label-${slotIndex}`);
  if (labelEl) labelEl.textContent = title;

  state.slots[slotIndex] = {
    tabId, title, stream, videoEl: video,
    gainNode, sourceNode, analyserNode,
    volume: 100, muted: false, solo: false, hasAudio,
  };

  // Show audio pill
  updateAudioPill(slotIndex);
  updateAudioRouting();
  updateUI();
  rebuildMixerChannels();
}

function removeSource(slotIndex) {
  if (!state.slots[slotIndex]) return;
  stopStream(slotIndex);
  state.slots[slotIndex] = null;

  const slotEl = canvas.querySelector(`.slot[data-index="${slotIndex}"]`);
  slotEl.querySelector('.slot-empty').style.display = '';
  const labelEl = slotEl.querySelector(`#label-${slotIndex}`);
  if (labelEl) labelEl.textContent = '–';

  // Clear solo if this was the soloed slot
  if (state.soloIndex === slotIndex) state.soloIndex = null;

  updateAudioRouting();
  updateUI();
  rebuildMixerChannels();
}

function stopStream(slotIndex) {
  const s = state.slots[slotIndex];
  if (!s) return;
  if (s.sourceNode)   { try { s.sourceNode.disconnect(); } catch(e){} }
  if (s.gainNode)     { try { s.gainNode.disconnect(); } catch(e){} }
  if (s.analyserNode) { try { s.analyserNode.disconnect(); } catch(e){} }
  s.stream.getTracks().forEach(t => t.stop());
  if (s.videoEl && s.videoEl.parentNode) s.videoEl.parentNode.removeChild(s.videoEl);
}

// ── Audio routing ────────────────────────────────────────────────
function updateAudioRouting() {
  const soloActive = state.soloIndex !== null && state.slots[state.soloIndex];

  state.slots.forEach((slot, i) => {
    if (!slot || !slot.gainNode) return;

    let effective = 0;
    if (slot.muted) {
      effective = 0;
    } else if (soloActive) {
      effective = (i === state.soloIndex) ? (slot.volume / 100) : 0;
    } else {
      effective = slot.volume / 100;
    }

    slot.gainNode.gain.setTargetAtTime(effective, state.audioCtx.currentTime, 0.05);

    // Visual dimming for non-soloed slots
    const slotEl = canvas.querySelector(`.slot[data-index="${i}"]`);
    if (slotEl) {
      slotEl.classList.toggle('audio-dimmed', soloActive && i !== state.soloIndex && !slot.muted);
    }

    updateAudioPill(i);
  });

  updateStatusAudio();
}

function updateAudioPill(index) {
  const slot = state.slots[index];
  const pill = document.getElementById(`audio-pill-${index}`);
  if (!pill) return;

  if (!slot || !slot.hasAudio) {
    pill.classList.remove('visible');
    return;
  }

  const dot = pill.querySelector('.pill-dot');
  const txt = pill.querySelector('.pill-text');
  pill.classList.add('visible');

  const soloActive = state.soloIndex !== null;
  if (slot.muted) {
    dot.className = 'pill-dot muted';
    txt.textContent = 'Muted';
  } else if (soloActive && index === state.soloIndex) {
    dot.className = 'pill-dot solo';
    txt.textContent = 'Solo';
  } else if (soloActive && index !== state.soloIndex) {
    dot.className = 'pill-dot muted';
    txt.textContent = 'Off';
  } else {
    dot.className = 'pill-dot';
    txt.textContent = `${slot.volume}%`;
  }
}

// ── Solo / Mute ──────────────────────────────────────────────────
function toggleSolo(index) {
  const slot = state.slots[index];
  if (!slot || !slot.hasAudio) return;

  if (state.soloIndex === index) {
    // Un-solo
    state.soloIndex = null;
    slot.solo = false;
  } else {
    // Solo this slot (un-solo previous)
    if (state.soloIndex !== null && state.slots[state.soloIndex]) {
      state.slots[state.soloIndex].solo = false;
    }
    state.soloIndex = index;
    slot.solo = true;
  }

  updateSlotCtrlStates(index);
  if (state.soloIndex !== null) updateSlotCtrlStates(state.soloIndex);
  updateAudioRouting();
  rebuildMixerChannels();
}

function toggleMute(index) {
  const slot = state.slots[index];
  if (!slot || !slot.hasAudio) return;
  slot.muted = !slot.muted;
  updateSlotCtrlStates(index);
  updateAudioRouting();
  rebuildMixerChannels();
}

function updateSlotCtrlStates(index) {
  const slot = state.slots[index];
  const slotEl = canvas.querySelector(`.slot[data-index="${index}"]`);
  if (!slotEl || !slot) return;

  const soloBtn = slotEl.querySelector('.slot-ctrl-btn.audio-solo');
  const muteBtn = slotEl.querySelector('.slot-ctrl-btn.audio-mute');
  if (soloBtn) soloBtn.classList.toggle('solo-on', slot.solo);
  if (muteBtn) muteBtn.classList.toggle('mute-on', slot.muted);
}

// ── Mixer panel ──────────────────────────────────────────────────
function bindMixer() {
  mixerToggle.addEventListener('click', () => {
    state.mixerOpen = !state.mixerOpen;
    mixerPanel.classList.toggle('mixer-hidden', !state.mixerOpen);
    mixerToggle.classList.toggle('active', state.mixerOpen);
    if (state.mixerOpen) rebuildMixerChannels();
  });

  masterVolEl.addEventListener('input', () => {
    const v = parseInt(masterVolEl.value);
    state.masterVolume = v / 100;
    masterVolVal.textContent = v + '%';
    if (state.masterGain) {
      state.masterGain.gain.setTargetAtTime(state.masterVolume, state.audioCtx.currentTime, 0.05);
    }
  });
}

function rebuildMixerChannels() {
  if (!state.mixerOpen) return;
  mixerChannels.innerHTML = '';

  const active = state.slots.filter(Boolean);
  if (active.length === 0) {
    mixerChannels.innerHTML = '<span style="font-size:12px;color:var(--text3);">No sources captured yet.</span>';
    return;
  }

  state.slots.forEach((slot, i) => {
    if (!slot) return;

    const ch = document.createElement('div');
    ch.className = 'mixer-ch';
    ch.dataset.index = i;

    const soloActive = state.soloIndex !== null;
    const isOff = soloActive && i !== state.soloIndex && !slot.muted;

    ch.innerHTML = `
      <div class="mixer-ch-header">
        <span class="mixer-ch-name" title="${escHtml(slot.title)}">${escHtml(slot.title)}</span>
        <div class="mixer-ch-btns">
          <button class="ch-btn solo-btn ${slot.solo ? 'solo-active' : ''}" data-index="${i}">S</button>
          <button class="ch-btn mute-btn ${slot.muted ? 'mute-active' : ''}" data-index="${i}">M</button>
        </div>
      </div>
      <div class="ch-row">
        <input type="range" class="vol-slider ch-vol" min="0" max="150" value="${slot.volume}" data-index="${i}" ${!slot.hasAudio ? 'disabled' : ''}>
        <span class="ch-vol-val" id="ch-vol-val-${i}">${slot.volume}%</span>
      </div>
      <div class="vu-wrap" id="vu-wrap-${i}" style="${!slot.hasAudio ? 'opacity:0.3' : ''}">
        <div class="vu-bar" id="vu-${i}"></div>
      </div>
      ${!slot.hasAudio ? '<span style="font-size:10px;color:var(--text3);">No audio</span>' : ''}
    `;

    ch.querySelector('.solo-btn').addEventListener('click', () => toggleSolo(i));
    ch.querySelector('.mute-btn').addEventListener('click', () => toggleMute(i));
    ch.querySelector('.ch-vol').addEventListener('input', (e) => {
      const v = parseInt(e.target.value);
      slot.volume = v;
      document.getElementById(`ch-vol-val-${i}`).textContent = v + '%';
      updateAudioRouting();
      updateAudioPill(i);
    });

    mixerChannels.appendChild(ch);
  });

  startVuMeters();
}

// ── VU meters ────────────────────────────────────────────────────
function startVuMeters() {
  if (state.vuAnimFrame) cancelAnimationFrame(state.vuAnimFrame);

  function tick() {
    state.slots.forEach((slot, i) => {
      if (!slot || !slot.analyserNode) return;
      const bar = document.getElementById(`vu-${i}`);
      if (!bar) return;

      const data = new Uint8Array(slot.analyserNode.frequencyBinCount);
      slot.analyserNode.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const pct = Math.min(100, (avg / 255) * 100 * 3);

      bar.style.width = pct + '%';
      bar.className = 'vu-bar' + (pct > 80 ? ' high' : pct > 50 ? ' medium' : '');
    });

    state.vuAnimFrame = requestAnimationFrame(tick);
  }

  state.vuAnimFrame = requestAnimationFrame(tick);
}

// ── Fullscreen ───────────────────────────────────────────────────
function bindFullscreen() {
  fsCloseBtn.addEventListener('click', closeFullscreen);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.fullscreenIndex !== null) closeFullscreen();
  });
}

function openFullscreen(index) {
  const slot = state.slots[index];
  if (!slot) return;

  state.fullscreenIndex = index;
  fsVideo.srcObject = slot.stream;
  fsLabel.textContent = slot.title;

  const soloActive = state.soloIndex !== null;
  const isSolo = state.soloIndex === index;
  const isMuted = slot.muted;
  if (isSolo) {
    fsAudioBadge.textContent = 'Solo';
    fsAudioBadge.classList.add('visible');
  } else if (isMuted) {
    fsAudioBadge.textContent = 'Muted';
    fsAudioBadge.classList.add('visible');
  } else {
    fsAudioBadge.classList.remove('visible');
  }

  fsOverlay.classList.remove('fs-hidden');
}

function closeFullscreen() {
  fsOverlay.classList.add('fs-hidden');
  fsVideo.srcObject = null;
  state.fullscreenIndex = null;
}

// ── UI update ─────────────────────────────────────────────────────
function updateUI() {
  const active = state.slots.filter(Boolean).length;
  canvasEmpty.style.display = active === 0 ? '' : 'none';

  if (active === 0) {
    statusCount.innerHTML = `<span class="status-dot"></span>No active sources`;
  } else {
    statusCount.innerHTML = `<span class="status-dot live"></span>${active} source${active > 1 ? 's' : ''} live`;
  }

  updateAddButton();
  updateStatusAudio();
}

function updateStatusAudio() {
  const withAudio = state.slots.filter(s => s && s.hasAudio).length;
  const soloActive = state.soloIndex !== null;

  if (withAudio === 0) {
    statusAudio.textContent = '';
  } else if (soloActive && state.slots[state.soloIndex]) {
    statusAudio.textContent = `Solo: ${truncateName(state.slots[state.soloIndex].title)}`;
  } else {
    statusAudio.textContent = `Audio: ${withAudio} channel${withAudio > 1 ? 's' : ''} live`;
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== '/' ? u.pathname.slice(0, 30) : '');
  } catch { return url.slice(0, 50); }
}

function truncateName(name) {
  return name && name.length > 22 ? name.slice(0, 22) + '…' : name;
}

// ── Boot ────────────────────────────────────────────────────────
init();

// Store this viewer page's own tab ID so the background can restore focus after capture
let viewerOwnTabId = null;
chrome.tabs.getCurrent(tab => { viewerOwnTabId = tab ? tab.id : null; });
