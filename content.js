(() => {
  if (window.__voiceReaderInjected) return;
  window.__voiceReaderInjected = true;

  const SELECTOR = "p, h1, h2, h3, h4, li, blockquote, article";
  const EXCLUDED_ANCESTORS =
    "nav, header, footer, aside, [role='navigation'], script, style, noscript, template, [hidden], [aria-hidden='true']";
  const STYLE_ID = "live-dom-voice-reader-style";
  const ACTIVE_CLASS = "live-dom-voice-reader-active";

  const state = {
    blocks: [],
    index: 0,
    reading: false,
    paused: false,
    voiceURI: "",
    utterance: null,
    session: 0,
    activeElement: null
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${ACTIVE_CLASS} {
        outline: 2px solid #e0a45b !important;
        outline-offset: 4px !important;
        background-color: rgba(224, 164, 91, 0.13) !important;
        border-radius: 3px !important;
        transition: background-color 160ms ease, outline-color 160ms ease !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    if (element.closest(EXCLUDED_ANCESTORS)) return false;

    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number(style.opacity) === 0 ||
        current.hidden ||
        current.getAttribute("aria-hidden") === "true"
      ) {
        return false;
      }
      current = current.parentElement;
    }
    return true;
  }

  function normalizeText(value) {
    return value.replace(/\\s+/g, " ").trim();
  }

  function collectBlocks() {
    const candidates = Array.from(document.querySelectorAll(SELECTOR))
      .filter(isVisible)
      .map((element) => ({
        element,
        text: normalizeText(element.innerText || element.textContent || "")
      }))
      .filter((item) => item.text.length > 0);

    // Avoid reading an article/list/quote container and its child blocks twice.
    return candidates.filter(({ element, text }) => {
      const nested = candidates.filter((candidate) =>
        candidate.element !== element && element.contains(candidate.element)
      );
      if (!nested.length) return true;

      const tag = element.tagName.toLowerCase();
      if (tag === "article" || tag === "blockquote") return false;

      if (tag === "li") {
        const hasStructuredChild = nested.some(({ element: child }) =>
          /^(P|H1|H2|H3|H4|BLOCKQUOTE|UL|OL)$/.test(child.tagName)
        );
        if (hasStructuredChild) return false;
      }

      const nestedText = normalizeText(nested.map((item) => item.text).join(" "));
      return text !== nestedText;
    });
  }

  function clearHighlight() {
    if (state.activeElement) {
      state.activeElement.classList.remove(ACTIVE_CLASS);
      state.activeElement = null;
    }
  }

  function highlight(element) {
    clearHighlight();
    state.activeElement = element;
    element.classList.add(ACTIVE_CLASS);
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  function finishSession(session) {
    if (session !== state.session) return;
    state.reading = false;
    state.paused = false;
    state.utterance = null;
    clearHighlight();
  }

  function speakCurrent(session) {
    if (session !== state.session || !state.reading || state.paused) return;

    if (state.index >= state.blocks.length) {
      finishSession(session);
      return;
    }

    const block = state.blocks[state.index];
    if (!block || !block.element.isConnected || !isVisible(block.element)) {
      state.index += 1;
      speakCurrent(session);
      return;
    }

    highlight(block.element);
    const utterance = new SpeechSynthesisUtterance(block.text);
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find((voice) => voice.voiceURI === state.voiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    }

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (session !== state.session) return;
      state.index += 1;
      speakCurrent(session);
    };
    utterance.onerror = (event) => {
      if (session !== state.session) return;
      if (event.error === "canceled" || event.error === "interrupted") return;
      state.index += 1;
      speakCurrent(session);
    };

    state.utterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function start(voiceURI) {
    window.speechSynthesis.cancel();
    state.session += 1;
    state.voiceURI = typeof voiceURI === "string" ? voiceURI : "";
    state.blocks = collectBlocks();
    state.index = 0;
    state.paused = false;
    state.reading = state.blocks.length > 0;
    clearHighlight();

    if (!state.blocks.length) {
      return { ok: false, message: "No readable page content was found." };
    }

    speakCurrent(state.session);
    return { ok: true, count: state.blocks.length };
  }

  function pause() {
    if (!state.reading || state.paused) return { ok: false, message: "Nothing is playing." };
    window.speechSynthesis.pause();
    state.paused = true;
    return { ok: true };
  }

  function resume() {
    if (!state.reading || !state.paused) return { ok: false, message: "Reading is not paused." };
    state.paused = false;
    window.speechSynthesis.resume();
    return { ok: true };
  }

  function stop() {
    state.session += 1;
    state.reading = false;
    state.paused = false;
    state.utterance = null;
    state.blocks = [];
    state.index = 0;
    window.speechSynthesis.cancel();
    clearHighlight();
    return { ok: true };
  }

  function getVoices() {
    return window.speechSynthesis.getVoices().map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI,
      default: voice.default
    }));
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.action !== "string") return false;

    switch (message.action) {
      case "START":
        sendResponse(start(message.voiceURI));
        return false;
      case "PAUSE":
        sendResponse(pause());
        return false;
      case "RESUME":
        sendResponse(resume());
        return false;
      case "STOP":
        sendResponse(stop());
        return false;
      case "GET_STATUS":
        sendResponse({
          reading: state.reading,
          paused: state.paused,
          index: state.index,
          total: state.blocks.length
        });
        return false;
      case "GET_VOICES": {
        const voices = getVoices();
        if (voices.length) {
          sendResponse({ voices });
          return false;
        }

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.speechSynthesis.removeEventListener("voiceschanged", finish);
          sendResponse({ voices: getVoices() });
        };
        window.speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
        window.setTimeout(finish, 1200);
        return true;
      }
      default:
        return false;
    }
  });

  injectStyles();
})();
