const ACTIVE_STORAGE_PREFIX = "active-enabled:";

const ICON_PATHS = {
  base: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  copy: {
    16: "icons/icon-copy-16.png",
    32: "icons/icon-copy-32.png",
    48: "icons/icon-copy-48.png",
    128: "icons/icon-copy-128.png",
  },
  active: {
    16: "icons/icon-active-16.png",
    32: "icons/icon-active-32.png",
    48: "icons/icon-active-48.png",
    128: "icons/icon-active-128.png",
  },
  both: {
    16: "icons/icon-both-16.png",
    32: "icons/icon-both-32.png",
    48: "icons/icon-both-48.png",
    128: "icons/icon-both-128.png",
  },
};

function iconForState(copyEnabled, activeEnabled) {
  if (copyEnabled && activeEnabled) return ICON_PATHS.both;
  if (copyEnabled) return ICON_PATHS.copy;
  if (activeEnabled) return ICON_PATHS.active;
  return ICON_PATHS.base;
}

async function updateActionState(tabId, state = {}) {
  if (!Number.isInteger(tabId)) return;
  const icon = iconForState(Boolean(state.copyEnabled), Boolean(state.activeEnabled));
  await Promise.all([
    chrome.action.setIcon({ tabId, path: icon }),
    chrome.action.setBadgeText({ tabId, text: "" }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#17765a" }),
  ]);
}

async function syncTabIcon(tabId) {
  try {
    const state = await chrome.tabs.sendMessage(tabId, { type: "INVISBL_GET_STATE" });
    await updateActionState(tabId, state);
  } catch {
    await updateActionState(tabId);
  }
}

function registrationId(origin) {
  let hash = 2166136261;
  for (const character of origin) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `always-active-${(hash >>> 0).toString(36)}`;
}

function matchPattern(origin) {
  if (origin === "null") return "file:///*";
  const url = new URL(origin);
  if (url.protocol === "file:") return "file:///*";
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Always-active mode is only available on regular websites.");
  }
  return `${url.protocol}//${url.hostname}/*`;
}

async function configureAlwaysActive(origin, enabled) {
  const id = registrationId(origin);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });

  if (!enabled) {
    if (existing.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [id] });
    }
    return;
  }

  const matches = [matchPattern(origin)];
  if (existing.length && existing[0].matches?.join() === matches.join()) return;
  if (existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  }

  await chrome.scripting.registerContentScripts([{
    id,
    matches,
    js: ["always-active.js"],
    runAt: "document_start",
    allFrames: true,
    world: "MAIN",
    persistAcrossSessions: true,
  }]);
}

async function reconcileRegistrations() {
  const stored = await chrome.storage.local.get(null);
  const registrations = Object.entries(stored)
    .filter(([key, enabled]) => key.startsWith(ACTIVE_STORAGE_PREFIX) && enabled)
    .map(([key]) => configureAlwaysActive(key.slice(ACTIVE_STORAGE_PREFIX.length), true));
  await Promise.allSettled(registrations);
}

chrome.runtime.onInstalled.addListener(() => void reconcileRegistrations());
chrome.runtime.onStartup.addListener(() => void reconcileRegistrations());
chrome.tabs.onActivated.addListener(({ tabId }) => void syncTabIcon(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") void syncTabIcon(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "INVISBL_STATE" && sender.frameId === 0) {
    void updateActionState(sender.tab?.id, message);
    return;
  }

  if (message?.type === "INVISBL_CONFIGURE_ACTIVE") {
    void configureAlwaysActive(message.origin, Boolean(message.enabled))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    if (command === "copy-mode-shortcut") {
      const state = await chrome.tabs.sendMessage(tab.id, { type: "INVISBL_TOGGLE_COPY" });
      await updateActionState(tab.id, state);
      return;
    }

    if (command === "active-mode-shortcut") {
      const state = await chrome.tabs.sendMessage(tab.id, { type: "INVISBL_GET_STATE" });
      const enabled = !state.activeEnabled;
      const updated = await chrome.tabs.sendMessage(tab.id, {
        type: "INVISBL_SET_ACTIVE",
        enabled,
      });
      await configureAlwaysActive(new URL(tab.url).origin, enabled);
      await updateActionState(tab.id, { ...state, activeEnabled: updated.enabled });
      await chrome.tabs.reload(tab.id);
    }
  } catch {
    await updateActionState(tab.id);
  }
});
