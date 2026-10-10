(() => {
  "use strict";

  if (window.__invisblLoaded) return;
  window.__invisblLoaded = true;

  const COPY_STYLE_ID = "invisbl-copy-style";
  const COPY_STORAGE_PREFIX = "copy-enabled:";
  const ACTIVE_STORAGE_PREFIX = "active-enabled:";
  const BLOCKED_COPY_EVENTS = ["copy", "cut", "contextmenu", "selectstart", "dragstart"];
  const EDITABLE_SELECTOR = "input, textarea, [contenteditable='true'], [contenteditable='']";

  let copyEnabled = false;
  let activeEnabled = false;

  function storageKeys() {
    return {
      copy: `${COPY_STORAGE_PREFIX}${location.origin}`,
      active: `${ACTIVE_STORAGE_PREFIX}${location.origin}`,
    };
  }

  function isEditable(target) {
    return target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR));
  }

  function neutralizePageBlocker(event) {
    if (!copyEnabled || isEditable(event.target)) return;
    event.stopImmediatePropagation();
  }

  function neutralizeBlockedShortcut(event) {
    if (!copyEnabled || isEditable(event.target)) return;
    if (!(event.ctrlKey || event.metaKey)) return;

    const key = event.key.toLowerCase();
    if (key === "a" || key === "c" || key === "x") {
      event.stopImmediatePropagation();
    }
  }

  function ensureCopyStyle() {
    if (document.getElementById(COPY_STYLE_ID)) return;

    const root = document.head || document.documentElement;
    if (!root) {
      document.addEventListener("readystatechange", ensureCopyStyle, { once: true });
      return;
    }

    const style = document.createElement("style");
    style.id = COPY_STYLE_ID;
    style.textContent = `
      html[data-invisbl-copy="on"],
      html[data-invisbl-copy="on"] body,
      html[data-invisbl-copy="on"] body *:not(input):not(textarea) {
        -webkit-user-select: text !important;
        user-select: text !important;
      }

      html[data-invisbl-copy="on"] body *::selection {
        color: HighlightText !important;
        background: Highlight !important;
      }
    `;
    root.appendChild(style);
  }

  function syncCopyAttribute() {
    if (!document.documentElement) {
      document.addEventListener("readystatechange", syncCopyAttribute, { once: true });
      return;
    }
    if (copyEnabled) {
      document.documentElement.setAttribute("data-invisbl-copy", "on");
    } else {
      document.documentElement.removeAttribute("data-invisbl-copy");
    }
  }

  function reportState() {
    if (window.top !== window) return;
    chrome.runtime.sendMessage({
      type: "INVISBL_STATE",
      copyEnabled,
      activeEnabled,
    }).catch(() => {});
  }

  function applyCopyState(enabled) {
    copyEnabled = Boolean(enabled);
    ensureCopyStyle();
    syncCopyAttribute();
    reportState();
  }

  function applyActiveState(enabled) {
    activeEnabled = Boolean(enabled);
    reportState();
  }

  async function setCopyState(enabled) {
    applyCopyState(enabled);
    const { copy } = storageKeys();
    await chrome.storage.local.set({ [copy]: copyEnabled });
    return copyEnabled;
  }

  async function setActiveState(enabled) {
    applyActiveState(enabled);
    const { active } = storageKeys();
    await chrome.storage.local.set({ [active]: activeEnabled });
    return activeEnabled;
  }

  function matchesShortcut(event, key) {
    if (
      event.repeat ||
      event.altKey ||
      !event.shiftKey ||
      event.code !== `Key${key.toUpperCase()}`
    ) return false;
    return event.ctrlKey && !event.metaKey;
  }

  async function toggleActiveFromPage() {
    const previousState = activeEnabled;
    const nextState = !previousState;

    try {
      await setActiveState(nextState);
      const configured = await chrome.runtime.sendMessage({
        type: "INVISBL_CONFIGURE_ACTIVE",
        origin: location.origin,
        enabled: nextState,
      });
      if (!configured?.ok) throw new Error(configured?.error || "Could not configure Always active.");
      location.reload();
    } catch {
      await setActiveState(previousState);
    }
  }

  function handlePageShortcut(event) {
    if (window.top !== window || isEditable(event.target)) return;

    if (matchesShortcut(event, "y")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void setCopyState(!copyEnabled);
      return;
    }

    if (matchesShortcut(event, "u")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void toggleActiveFromPage();
    }
  }

  for (const eventType of BLOCKED_COPY_EVENTS) {
    window.addEventListener(eventType, neutralizePageBlocker, true);
  }
  window.addEventListener("keydown", neutralizeBlockedShortcut, true);
  window.addEventListener("keydown", handlePageShortcut, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "INVISBL_GET_STATE") {
      sendResponse({ copyEnabled, activeEnabled });
      return;
    }

    if (message?.type === "INVISBL_SET_COPY") {
      void setCopyState(Boolean(message.enabled)).then((enabled) => sendResponse({ enabled }));
      return true;
    }

    if (message?.type === "INVISBL_SET_ACTIVE") {
      void setActiveState(Boolean(message.enabled)).then((enabled) => sendResponse({ enabled }));
      return true;
    }

    if (message?.type === "INVISBL_TOGGLE_COPY") {
      void setCopyState(!copyEnabled).then(() => sendResponse({ copyEnabled, activeEnabled }));
      return true;
    }

    if (message?.type === "INVISBL_TOGGLE_ACTIVE") {
      void setActiveState(!activeEnabled).then(() => sendResponse({ copyEnabled, activeEnabled }));
      return true;
    }
  });

  const keys = storageKeys();
  void chrome.storage.local.get([keys.copy, keys.active]).then((stored) => {
    applyCopyState(Boolean(stored[keys.copy]));
    applyActiveState(Boolean(stored[keys.active]));
  });
})();
