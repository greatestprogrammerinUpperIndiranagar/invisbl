(() => {
  "use strict";

  if (window.__invisblAlwaysActive) return;
  window.__invisblAlwaysActive = true;

  const BLOCKED_EVENTS = [
    "visibilitychange",
    "webkitvisibilitychange",
    "mozvisibilitychange",
    "blur",
    "mouseleave",
  ];

  function findDescriptor(object, property) {
    let current = object;
    while (current) {
      const descriptor = Object.getOwnPropertyDescriptor(current, property);
      if (descriptor) return descriptor;
      current = Object.getPrototypeOf(current);
    }
    return undefined;
  }

  const descriptors = {
    hidden: findDescriptor(document, "hidden"),
    webkitHidden: findDescriptor(document, "webkitHidden"),
    mozHidden: findDescriptor(document, "mozHidden"),
    visibilityState: findDescriptor(document, "visibilityState"),
    webkitVisibilityState: findDescriptor(document, "webkitVisibilityState"),
    mozVisibilityState: findDescriptor(document, "mozVisibilityState"),
  };
  function defineDocumentValue(property, value) {
    try {
      Object.defineProperty(document, property, {
        configurable: true,
        enumerable: descriptors[property]?.enumerable ?? true,
        get: () => value,
      });
    } catch {
      // Leave browser-specific, non-configurable properties unchanged.
    }
  }

  defineDocumentValue("hidden", false);
  defineDocumentValue("webkitHidden", false);
  defineDocumentValue("mozHidden", false);
  defineDocumentValue("visibilityState", "visible");
  defineDocumentValue("webkitVisibilityState", "visible");
  defineDocumentValue("mozVisibilityState", "visible");

  try {
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      enumerable: true,
      value: () => true,
    });
  } catch {
    document.hasFocus = () => true;
  }

  function blockInactiveSignal(event) {
    if (event.type === "blur" && event.target !== window) return;
    if (event.type === "mouseleave" && ![window, document, document.documentElement].includes(event.target)) return;
    event.stopImmediatePropagation();
  }

  for (const eventType of BLOCKED_EVENTS) {
    window.addEventListener(eventType, blockInactiveSignal, true);
  }

  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));

})();
