# AGENTS.md

## Chrome DevTools MCP

- Connect Chrome DevTools MCP with `--browser-url=http://localhost:9222`. (Note: use `localhost` instead of `127.0.0.1` to avoid Node.js fetch ECONNREFUSED/IPv6 resolution errors)
- Do not rely on `--autoConnect` for this repo's browser testing. Direct `browser-url` connection is the stable path that worked.
- Preferred test browser launch on this machine (use `cmd /c start` to ensure arguments parse correctly without hanging the terminal):

```cmd
cmd /c 'start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\Chrome_MCP_Data" --profile-directory="Profile 1" --load-extension="D:\#GITHUB_melody0709\chrome_pip_mode"'
```

- Use the built-in MCP server for testing (e.g. `@modelcontextprotocol/server-puppeteer` tools) connected to `ws://127.0.0.1:9222` instead of writing custom Node.js Puppeteer scripts.
- You can get the active WebSocket endpoints via `curl -s http://127.0.0.1:9222/json`.
- **Critical Note:** Never run `npm install puppeteer-core` or create temporary `test_extension.js` files in this directory. Rely entirely on external MCP tools or temporary scripts in `$env:TEMP` to avoid cluttering the repository with `node_modules` and `package.json`.

- `D:\Chrome_MCP_Data` is the mirrored test profile used for MCP-driven browser testing.
- The mirrored profile was prepared from `C:\Users\kawae\AppData\Local\Google\Chrome\User Data\Profile 1`.
- After editing extension files, reload `Floating Video Resizer` in `chrome://extensions/` before testing.
- Primary Bilibili regression page used during this task: `https://www.bilibili.com/video/BV1xx411c7mD/`.

## Floating Player Notes

- Bilibili floating mode should be detected from the native mini-player visibility state, not from `position: fixed` alone.
- Legacy saved geometry can override new defaults; keep the storage schema version in sync when changing default layout behavior.
- On Bilibili cleanup, clear extension-managed geometry styles instead of restoring native floating offsets.

