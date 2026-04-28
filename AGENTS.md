# AGENTS.md

## Commands & Workflow

### Browser Setup for Testing
Launch Chrome with the extension loaded and remote debugging enabled:
```cmd
cmd /c 'start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\Chrome_MCP_Data" --profile-directory="Profile 1" --load-extension="D:\#GITHUB_melody0709\chrome_pip_mode"'
```

### Verification
- **Manual:** After editing, reload "Floating Video Resizer" in `chrome://extensions/`.
- **MCP:** Use `--browser-url=http://localhost:9222`. Prefer `chrome-devtools-mcp` for Chrome DevTools Protocol testing.
- **Regression Page:** `https://www.bilibili.com/video/BV1xx411c7mD/`

### Critical Constraints

- **NO `npm install`:** This repo has no `package.json` for runtime dependencies (only dev types). Do NOT create or install `node_modules`. Use `$env:TEMP` for temporary scripts.
- **MCP Connection:** For `chrome-devtools-mcp`, use `localhost` and do not rely on `--autoConnect`. For ad-hoc Node CDP scripts, `127.0.0.1` may be more stable if `fetch("http://localhost:9222")` times out.
- **Bilibili Login State:** Use `--user-data-dir="D:\Chrome_MCP_Data" --profile-directory="Profile 1"` for Bilibili regression tests. Do not use a fresh temporary Chrome profile unless explicitly testing logged-out behavior.

## Architecture & Logic Quirks

- **Site Controllers:** `content.js` uses a strategy pattern. `getSiteController()` returns an object with site-specific logic (Bilibili/YouTube).
- **Floating Detection:**
  - **Bilibili:** Must be detected from the native mini-player visibility state, NOT `position: fixed` alone.
  - **YouTube:** Logic based on scroll threshold and player visibility.
- **CSS Piercing (YouTube):** YouTube requires adding `ANCESTOR_OVERFLOW_CLASS` to all parent elements to ensure the player isn't clipped by `overflow: hidden` when floating.
- **Drag & Drop:** `MOVE_EXCLUDE_SELECTOR` prevents dragging when interacting with players controls or standard UI elements (links, buttons).
- **Storage:** Uses `chrome.storage.local` with `STORAGE_SCHEMA_VERSION`. Increment this when changing geometry defaults to invalidate old user state.
- **Cleanup:** On Bilibili, clear extension-managed styles instead of restoring native offsets.

##
- 浮窗记住离窗口底部高度,不随放大缩小而变化,也不随拉伸窗口而变化
  
## 踩坑规则

> AI 在完成重大修改或解决复杂报错后，可追加规则。
 
- Bilibili 浮窗清理时应直接清除 extension 注入的 style，而非尝试恢复原位，否则会导致定位错乱。
- YouTube 浮窗需要递归修改父级 `overflow` 属性（`ANCESTOR_OVERFLOW_CLASS`），否则会被容器裁剪。
- Chrome content scripts run in an isolated world: page JS may not see flags like `window.__floatingVideoToolsLoaded`. Confirm injection via DOM effects such as `#copilot-floating-player-style` or extension classes instead.
- After editing `content.js`, reload the unpacked extension in `chrome://extensions/`; reloading the Bilibili page alone can keep running a stale content script. If behavior looks impossible, confirm the loaded `chrome-extension://.../content.js` source through CDP `Debugger.scriptParsed`.
- Chrome page zoom changes CSS pixels and `devicePixelRatio`; validate floating-player size by checking physical size (`getBoundingClientRect().height * devicePixelRatio`), not CSS height alone.
- Rapid zoom can briefly deactivate/reactivate the native mini-player. Do not persist geometry on reactivation when `savedGeometry` already exists, or an intermediate clamped frame can become the new remembered anchor.
