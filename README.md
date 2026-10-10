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

- Toggle **Allow copy** with `Ctrl+Shift+Y` (`Command+Shift+Y` on macOS).
- Toggle **Always active** with `Ctrl+Shift+U` (`Command+Shift+U` on macOS).

Version 1.2.2 uses fresh command IDs (`docs-copy-y` and `docs-active-u`) so Chrome does not reuse the earlier C/A shortcut assignments. If an older Docs entry is still installed, remove it or load this version as a new unpacked extension, then verify the two assignments at `chrome://extensions/shortcuts`.

If Chrome has a local shortcut collision, change the commands at `chrome://extensions/shortcuts`.

After updating from an earlier build, reload the extension once so Chrome replaces the previous command registrations with the current ones.

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
- CodePen uses separate `codepen.io` and `cdpn.io` frame origins; enabling Always active on either one also covers the other so the preview frame receives the same page-level overrides.
- The extension does not bypass paywalls, authentication, encryption, or access controls; it only changes browser-side behavior for content already available to the user.

## Privacy

Invisbl has no analytics, no network requests, and no server. The only saved data is whether each feature is enabled for each website.
