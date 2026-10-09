# Docs

A small, dependency-free Chrome extension with two keyboard-controlled tools:

- **Allow copy** restores text selection, copying, drag selection, and the context menu on websites that block them.
- **Always active** makes a chosen website report that it is visible and focused even after you switch tabs or windows.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Choose this project folder.
5. Pin **Invisbl** from Chrome's extensions menu for quick access.

## Use it

The popup includes quick links to Google Docs and Google Slides. Use the keyboard shortcuts on a regular website to control the two page tools. Each setting is remembered separately for each website. The extension also listens directly for these shortcuts on the active page, so they work even if Chrome did not assign the suggested command keys.

- Toggle **Allow copy** with `Ctrl+Shift+C` (`Control+Shift+C` on macOS).
- Toggle **Always active** with `Ctrl+Shift+A` (`Control+Shift+A` on macOS).

Chrome may reserve `Ctrl+Shift+C` for its DevTools element picker. If Chrome claims that key, change the shortcut at `chrome://extensions/shortcuts`; the page-level fallback also accepts `Alt+Shift+C`.

There is no visible toolbar badge or page overlay.

### Test locally

The project includes `test/demo.html`, which contains intentionally copy-blocked text and a live visibility-state readout. In Chrome's extension details, enable **Allow access to file URLs**, then open that file in Chrome and test both toggles.

## How Always active works

When enabled, the extension runs inside the page and reports:

- `document.hidden` as `false`
- `document.visibilityState` as `visible`
- `document.hasFocus()` as `true`

It also suppresses visibility-change, blur, and mouse-leave signals that websites commonly use to detect a background tab. Turning the feature off restores the browser's real values and events.

## Browser limits

- Chrome blocks extensions on internal pages such as `chrome://settings` and the Chrome Web Store.
- Chrome can still throttle timers, networking, or rendering in background tabs at the browser or operating-system level. An extension cannot override every form of resource throttling.
- Some sites use additional activity signals that may require site-specific handling.
- The extension does not bypass paywalls, authentication, encryption, or access controls; it only changes browser-side behavior for content already available to the user.

## Privacy

Invisbl has no analytics, no network requests, and no server. The only saved data is whether each feature is enabled for each website.
