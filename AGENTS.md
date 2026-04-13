# AGENTS.md

## Chrome DevTools MCP

- Connect Chrome DevTools MCP with `--browser-url=http://127.0.0.1:9222`.
- Do not rely on `--autoConnect` for this repo's browser testing. Direct `browser-url` connection is the stable path that worked.
- Preferred test browser launch on this machine:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="D:\Chrome_MCP_Data" \
  --profile-directory="Profile 1" \
  --load-extension="D:\#GITHUB_melody0709\chrome_pip_mode"
```

- `D:\Chrome_MCP_Data` is the mirrored test profile used for MCP-driven browser testing.
- The mirrored profile was prepared from `C:\Users\kawae\AppData\Local\Google\Chrome\User Data\Profile 1`.
- After editing extension files, reload `Floating Video Resizer` in `chrome://extensions/` before testing.
- Primary Bilibili regression page used during this task: `https://www.bilibili.com/video/BV1xx411c7mD/`.

## Floating Player Notes

- Bilibili floating mode should be detected from the native mini-player visibility state, not from `position: fixed` alone.
- Legacy saved geometry can override new defaults; keep the storage schema version in sync when changing default layout behavior.
- On Bilibili cleanup, clear extension-managed geometry styles instead of restoring native floating offsets.