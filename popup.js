const voiceSelect = document.getElementById("voice-select");
const playButton = document.getElementById("play");
const pauseButton = document.getElementById("pause");
const stopButton = document.getElementById("stop");
const statusElement = document.getElementById("status");

let activeTabId = null;

function setStatus(message) {
  statusElement.textContent = message;
}

function sendMessage(action, extra = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(activeTabId, { action, ...extra }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

async function prepareContentScript() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab is available.");
  }
  activeTabId = tab.id;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      files: ["content.js"]
    });
  } catch (error) {
    throw new Error(
      "This page does not allow extensions to read it. Try a regular webpage instead."
    );
  }
}

async function loadVoices() {
  const response = await sendMessage("GET_VOICES");
  const voices = response && Array.isArray(response.voices) ? response.voices : [];
  voiceSelect.replaceChildren();

  if (!voices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Browser default voice";
    voiceSelect.appendChild(option);
    return;
  }

  voices.sort((a, b) => {
    if (a.default !== b.default) return a.default ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  }
}

async function refreshStatus() {
  try {
    const status = await sendMessage("GET_STATUS");
    if (status.paused) {
      setStatus("Reading paused.");
    } else if (status.reading) {
      setStatus(`Reading section ${Math.min(status.index + 1, status.total)} of ${status.total}.`);
    } else {
      setStatus("Ready. Select Play to start reading.");
    }
  } catch (error) {
    setStatus(error.message);
  }
}

playButton.addEventListener("click", async () => {
  playButton.disabled = true;
  try {
    const current = await sendMessage("GET_STATUS");
    if (current.paused) {
      const response = await sendMessage("RESUME");
      setStatus(response.ok ? "Reading resumed." : response.message);
    } else if (current.reading) {
      setStatus("Reading is already in progress.");
    } else {
      const response = await sendMessage("START", {
        voiceURI: voiceSelect.value
      });
      if (response.ok) {
        setStatus(`Reading started. ${response.count} content blocks found.`);
      } else {
        setStatus(response.message || "Unable to start reading.");
      }
    }
  } catch (error) {
    setStatus(error.message);
  } finally {
    playButton.disabled = false;
  }
});

pauseButton.addEventListener("click", async () => {
  try {
    const response = await sendMessage("PAUSE");
    setStatus(response.ok ? "Reading paused." : response.message);
  } catch (error) {
    setStatus(error.message);
  }
});

stopButton.addEventListener("click", async () => {
  try {
    await sendMessage("STOP");
    setStatus("Reading stopped.");
  } catch (error) {
    setStatus(error.message);
  }
});

(async function initialize() {
  try {
    await prepareContentScript();
    await loadVoices();
    await refreshStatus();
  } catch (error) {
    setStatus(error.message);
    voiceSelect.replaceChildren();
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Unavailable on this page";
    voiceSelect.appendChild(option);
    playButton.disabled = true;
    pauseButton.disabled = true;
    stopButton.disabled = true;
  }
})();
