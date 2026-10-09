const ACTIVE_STORAGE_PREFIX = "active-enabled:";

async function updateBadge(tabId) {
  if (!Number.isInteger(tabId)) return;
  await Promise.all([
    chrome.action.setBadgeText({ tabId, text: "" }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#17765a" }),
  ]);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "INVISBL_STATE" && sender.frameId === 0) {
    void updateBadge(sender.tab?.id);
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
    if (command === "toggle-copy") {
      const state = await chrome.tabs.sendMessage(tab.id, { type: "INVISBL_TOGGLE_COPY" });
      await updateBadge(tab.id);
      return;
    }

    if (command === "toggle-active") {
      const state = await chrome.tabs.sendMessage(tab.id, { type: "INVISBL_GET_STATE" });
      const enabled = !state.activeEnabled;
      const updated = await chrome.tabs.sendMessage(tab.id, {
        type: "INVISBL_SET_ACTIVE",
        enabled,
      });
      await configureAlwaysActive(new URL(tab.url).origin, enabled);
      await updateBadge(tab.id);
      await chrome.tabs.reload(tab.id);
    }
  } catch {
    await updateBadge(tab.id);
  }
});
