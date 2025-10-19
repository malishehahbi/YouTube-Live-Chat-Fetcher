let polling = false;
let nextPageToken = '';
let liveChatId = '';
let apiKey = '';
let obsWindow = null;

const chat = document.getElementById('chat');
const loading = document.getElementById('loading');
const obsModeCheckbox = document.getElementById('obsMode');
const spotlight = document.getElementById('spotlight');
const openObsWindowBtn = document.getElementById('openObsWindow');

function showLoading(show) {
  loading.style.display = show ? 'block' : 'none';
}

function showError(msg) {
  chat.innerHTML = `<div style="color:#cc181e;font-weight:600;text-align:center;margin-top:2em;">${msg}</div>`;
}

async function getLiveChatId(streamId, apiKey) {
  showLoading(true);
  const url = `https://www.googleapis.com/youtube/v3/videos?id=${streamId}&part=liveStreamingDetails&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    showLoading(false);
    return data.items?.[0]?.liveStreamingDetails?.activeLiveChatId || '';
  } catch {
    showLoading(false);
    return '';
  }
}

async function fetchChat() {
  if (!liveChatId || !apiKey) return;
  showLoading(true);
  const url = `/api/livechat?liveChatId=${liveChatId}&apiKey=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    showLoading(false);
    if (data.error) {
      showError('Error: ' + data.error);
      polling = false;
      return;
    }
    nextPageToken = data.nextPageToken || '';
    renderChat(data.items || []);
    if (polling) setTimeout(fetchChat, data.pollingIntervalMillis || 2000);
  } catch {
    showLoading(false);
    showError('Network error.');
    polling = false;
  }
}

// Sync spotlight between main and OBS window
function setSpotlightData(html) {
  localStorage.setItem('yt-obs-spotlight', html || '');
}
window.addEventListener('storage', (e) => {
  if (e.key === 'yt-obs-spotlight') {
    updateObsSpotlight(e.newValue);
  }
});
function updateObsSpotlight(html) {
  if (window === obsWindow || window.name === 'obsChat') {
    let obsSpot = document.getElementById('spotlight');
    if (!obsSpot) {
      obsSpot = document.createElement('div');
      obsSpot.id = 'spotlight';
      obsSpot.style.display = 'flex';
      obsSpot.style.alignItems = 'center';
      obsSpot.style.justifyContent = 'center';
      obsSpot.style.position = 'fixed';
      obsSpot.style.left = '0';
      obsSpot.style.top = '0';
      obsSpot.style.right = '0';
      obsSpot.style.bottom = '0';
      obsSpot.style.zIndex = '1000';
      obsSpot.style.background = 'rgba(0,0,0,0.7)';
      document.body.appendChild(obsSpot);
    }
    obsSpot.innerHTML = html || '';
    obsSpot.style.display = html ? 'flex' : 'none';
    if (html) {
      obsSpot.onclick = function(e) { if (e.target === obsSpot) setSpotlightData(''); };
    }
  }
}

// Patch renderChat to sync spotlight
function renderChat(messages) {
  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `<span class="author">${msg.authorDetails.displayName}:</span> <span class="text">${msg.snippet.displayMessageHtml || msg.snippet.displayMessage}</span>`;
    div.addEventListener('click', e => {
      // Show spotlight with this message in main window
      spotlight.innerHTML = '';
      const spotDiv = div.cloneNode(true);
      spotDiv.style.cursor = 'default';
      spotlight.appendChild(spotDiv);
      spotlight.style.display = 'flex';
      // Sync to OBS window
      setSpotlightData(spotDiv.outerHTML);
    });
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    // Also render in OBS window if open
    if (obsWindow && !obsWindow.closed) {
      const obsChat = obsWindow.document.getElementById('chat');
      if (obsChat) {
        const obsDiv = div.cloneNode(true);
        obsChat.appendChild(obsDiv);
        obsChat.scrollTop = obsChat.scrollHeight;
      }
    }
  });
}

// Hide spotlight in both windows when closed
spotlight.addEventListener('click', e => {
  if (e.target === spotlight) {
    spotlight.style.display = 'none';
    setSpotlightData('');
  }
});

document.getElementById('chatForm').onsubmit = async e => {
  e.preventDefault();
  chat.innerHTML = '';
  nextPageToken = '';
  polling = true;
  apiKey = document.getElementById('apiKey').value.trim();
  const streamId = document.getElementById('streamId').value.trim();
  liveChatId = await getLiveChatId(streamId, apiKey);
  if (!liveChatId) {
    showError('Could not find live chat for this stream.');
    polling = false;
    return;
  }
  fetchChat();
};

// OBS Mode toggle
obsModeCheckbox.addEventListener('change', () => {
  document.body.classList.toggle('obs', obsModeCheckbox.checked);
});

// Open OBS window
openObsWindowBtn.addEventListener('click', () => {
  if (obsWindow && !obsWindow.closed) {
    obsWindow.focus();
    return;
  }
  obsWindow = window.open('', 'obsChat', 'width=600,height=400,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1');
  obsWindow.document.write(`
    <html><head><title>OBS Chat Overlay</title>
    <style>
      body { margin:0; background:transparent; }
      #chat { width:100vw; height:100vh; background:rgba(0,0,0,0.0); border:none; box-shadow:none; color:#fff; display:flex; flex-direction:column; gap:0.7em; padding:1em; }
      .msg { background:rgba(0,0,0,0.7); color:#fff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.18); font-size:1.15em; display:flex; align-items:flex-start; gap:0.7em; padding:0.5em 0.8em; }
      .author { color:#ffe082; font-weight:600; margin-right:0.3em; }
      .text { color:#fff; word-break:break-word; }
    </style>
    </head><body><div id="chat"></div></body></html>
  `);
  obsWindow.onload = function() {
    updateObsSpotlight(localStorage.getItem('yt-obs-spotlight'));
    obsWindow.addEventListener('storage', (e) => {
      if (e.key === 'yt-obs-spotlight') {
        obsWindow.updateObsSpotlight(e.newValue);
      }
    });
    obsWindow.updateObsSpotlight = updateObsSpotlight;
  };
});
