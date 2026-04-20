# AGENTS.md

## Commands & Workflow

### Browser Setup for Testing
Launch Chrome with the extension loaded and remote debugging enabled:
```cmd
cmd /c 'start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\Chrome_MCP_Data" --profile-directory="Profile 1" --load-extension="D:\#GITHUB_melody0709\chrome_pip_mode"'
```

### Verification
- **Manual:** After editing, reload "Floating Video Resizer" in `chrome://extensions/`.
- **MCP:** Use `--browser-url=http://localhost:9222`. Use `@modelcontextprotocol/server-puppeteer` tools.
- **Regression Page:** `https://www.bilibili.com/video/BV1xx411c7mD/`

### Critical Constraints
- **Sync Versioning:** Whenever a version change occurs, always update `manifest.json`, `package.json`, and `CHANGELOG.md` concurrently. Ensure consistency across all documentation (`README.md`, `README.zh-CN.md`).
- **NO `npm install`:** This repo has no `package.json` for runtime dependencies (only dev types). Do NOT create or install `node_modules`. Use `$env:TEMP` for temporary scripts.
- **MCP Connection:** Use `localhost` instead of `127.0.0.1` to avoid Node.js fetch errors. Do not rely on `--autoConnect`.

## Architecture & Logic Quirks

- **Site Controllers:** `content.js` uses a strategy pattern. `getSiteController()` returns an object with site-specific logic (Bilibili/YouTube).
- **Floating Detection:**
  - **Bilibili:** Must be detected from the native mini-player visibility state, NOT `position: fixed` alone.
  - **YouTube:** Logic based on scroll threshold and player visibility.
- **CSS Piercing (YouTube):** YouTube requires adding `ANCESTOR_OVERFLOW_CLASS` to all parent elements to ensure the player isn't clipped by `overflow: hidden` when floating.
- **Drag & Drop:** `MOVE_EXCLUDE_SELECTOR` prevents dragging when interacting with players controls or standard UI elements (links, buttons).
- **Storage:** Uses `chrome.storage.local` with `STORAGE_SCHEMA_VERSION`. Increment this when changing geometry defaults to invalidate old user state.
- **Cleanup:** On Bilibili, clear extension-managed styles instead of restoring native offsets.

## 踩坑规则

- Bilibili 浮窗清理时应直接清除 extension 注入的 style，而非尝试恢复原位，否则会导致定位错乱。
- YouTube 浮窗需要递归修改父级 `overflow` 属性（`ANCESTOR_OVERFLOW_CLASS`），否则会被容器裁剪。
