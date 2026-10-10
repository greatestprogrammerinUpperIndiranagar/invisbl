const copyToggle = document.querySelector("#copy-toggle");
const activeToggle = document.querySelector("#active-toggle");
const siteLabel = document.querySelector("#site-label");
const status = document.querySelector("#status");
const copyShortcutLabel = document.querySelector("#shortcut-label");
const activeShortcutLabel = document.querySelector("#active-shortcut-label");
const mark = document.querySelector(".mark");

let activeTab = null;
let currentCopyState = false;
let currentActiveState = false;

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

function setToggle(toggle, enabled) {
  toggle.setAttribute("aria-checked", String(Boolean(enabled)));
}

function setIndicatorState(copyEnabled, activeEnabled) {
  mark.classList.toggle("copy-on", Boolean(copyEnabled));
  mark.classList.toggle("active-on", Boolean(activeEnabled));
}

function displayHost(url) {
  try {
    return new URL(url).hostname || "This page";
  } catch {
    return "This page";
  }
}

async function sendToPage(message) {
  if (!activeTab?.id) throw new Error("No active page found.");
  return chrome.tabs.sendMessage(activeTab.id, message);
}

async function initialize() {
  if (navigator.userAgent.includes("Mac")) {
    copyShortcutLabel.textContent = "⌘ ⇧ Y";
    activeShortcutLabel.textContent = "⌘ ⇧ U";
  }

  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  siteLabel.textContent = displayHost(activeTab?.url);

  try {
    const pageState = await sendToPage({ type: "INVISBL_GET_STATE" });
    currentCopyState = pageState.copyEnabled;
    currentActiveState = pageState.activeEnabled;
    setToggle(copyToggle, currentCopyState);
    setToggle(activeToggle, currentActiveState);
    setIndicatorState(currentCopyState, currentActiveState);
  } catch {
    copyToggle.disabled = true;
    activeToggle.disabled = true;
    showStatus("Chrome does not allow extensions to change this page. Try a regular website.");
  }
}

copyToggle.addEventListener("click", async () => {
  copyToggle.disabled = true;
  showStatus("");
  try {
    const response = await sendToPage({
      type: "INVISBL_SET_COPY",
      enabled: !currentCopyState,
    });
    currentCopyState = response.enabled;
    setToggle(copyToggle, currentCopyState);
    setIndicatorState(currentCopyState, currentActiveState);
  } catch {
    showStatus("Copy mode could not be changed on this page.");
  } finally {
    copyToggle.disabled = false;
  }
});

activeToggle.addEventListener("click", async () => {
  activeToggle.disabled = true;
  showStatus("");
  const previousState = currentActiveState;
  let registrationChanged = false;
  try {
    const response = await sendToPage({
      type: "INVISBL_SET_ACTIVE",
      enabled: !currentActiveState,
    });
    currentActiveState = response.enabled;
    setToggle(activeToggle, currentActiveState);
    setIndicatorState(currentCopyState, currentActiveState);

    const configured = await chrome.runtime.sendMessage({
      type: "INVISBL_CONFIGURE_ACTIVE",
      origin: new URL(activeTab.url).origin,
      enabled: currentActiveState,
    });
    if (!configured?.ok) throw new Error(configured?.error || "Always-active mode could not be configured.");
    registrationChanged = true;

    showStatus("Reloading this page to apply the change…");
    await chrome.tabs.reload(activeTab.id);
    window.close();
  } catch {
    currentActiveState = previousState;
    setToggle(activeToggle, currentActiveState);
    setIndicatorState(currentCopyState, currentActiveState);
    await sendToPage({ type: "INVISBL_SET_ACTIVE", enabled: previousState }).catch(() => {});
    if (registrationChanged) {
      await chrome.runtime.sendMessage({
        type: "INVISBL_CONFIGURE_ACTIVE",
        origin: new URL(activeTab.url).origin,
        enabled: previousState,
      }).catch(() => {});
    }
    showStatus("Always-active mode could not be changed on this page.");
    activeToggle.disabled = false;
  }
});

void initialize();
