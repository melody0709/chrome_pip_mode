# AGENTS.md

## Commands & Workflow

### Browser Setup for Testing
Launch Chrome with the extension loaded and remote debugging enabled:
```cmd
cmd /c 'start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\Chrome_MCP_Data" --profile-directory="Profile 1" --load-extension="D:\GITHUB_melody0709\chrome_pip_mode\chrome_pip_mode"'
```

### Verification
- **Manual:** After editing, reload "Floating Video Resizer" in `chrome://extensions/`.
- **MCP:** Use `--browser-url=http://localhost:9222`. Prefer `chrome-devtools-mcp` for Chrome DevTools Protocol testing.
- **Regression Page:** `https://www.bilibili.com/video/BV1xx411c7mD/`

### Critical Constraints

- **NO `npm install`:** This repo has no `package.json` for runtime dependencies (only dev types). Do NOT create or install `node_modules`. Use `$env:TEMP` for temporary scripts.
- **MCP Connection:** For `chrome-devtools-mcp`, use `localhost` and do not rely on `--autoConnect`. For ad-hoc Node CDP scripts, `127.0.0.1` may be more stable if `fetch("http://localhost:9222")` times out.
- **Bilibili Login State:** Use `--user-data-dir="D:\Chrome_MCP_Data" --profile-directory="Profile 1"` for Bilibili regression tests. Do not use a fresh temporary Chrome profile unless explicitly testing logged-out behavior.

## 仓库状态（2026-09-20）

- 本仓库（`chrome_pip_mode`）是**唯一的活跃基座**，后续所有升级都在这里进行。
- 旧扩展（B站网页全屏快捷键）已移出，归档到 `D:\GITHUB_melody0709\chrome_pip_mode\.bak\bilibli_Tmode`（相对本仓库根即 `../.bak/bilibli_Tmode`）—— **拼写就是 `bilibli_`，少一个 `i`，这是最终名称**（改名试过多次均 `Permission denied`，连 Chrome 全退也无效，已放弃）。**只作只读参考，不再更新**。
- 归档目录由工作区根的 `.gitignore` 忽略（`.bak/`）。
- 升级方案文档：`D:\GITHUB_melody0709\chrome_pip_mode\chrome_pip_mode.plan\feat\PLAN.md`（位于工作区根，不在本仓库内）。
- 方案已过两轮核验（自审 + 外部审查），修正与实证记录见 PLAN.md §7；L0 施工与校验结果见 §9。

## 升级计划（进行中）

**L0 已落地（2026-09-20）**：`manifest.json` 改造为 v1.1.0 + 两条 entry；新增 `hotkey.js` / `background.js` / `options.html` / `options.js` / `tools/generate-icons.ps1` / `icons/`。`content.js` **零 diff**（blob 哈希与 HEAD 一致）。改动目前**留在 `main` 上未提交**，等复核。详见 PLAN.md §9。

目标：在本仓库基座上升级，把 B站网页全屏快捷键作为独立模块并入，替代原先两个各自独立的扩展。

- `content.js`（悬浮窗）**本次保持零 diff** —— 逻辑不改、不搬家、不改名、不删死代码（含 `content.js:320-339` 那段 localStorage 死代码）；`STORAGE_SCHEMA_VERSION = 6` 保留。理由是把风险集中在新文件上，**不要以"保护行号"当理由**，行号引用本就不该是硬约束。
- 快捷键功能重写为自包含模块 `hotkey.js`，常量与 `normalizeKey` 收进闭包，不再依赖顶层共享作用域；**不设 `shared/` 层**（同一文件进两条 entry 会重复声明顶层 `const`）。
- `options.html` / `options.js` / `background.js` / `icons/` 均为**新增**：基座根目录原本没有设置页，只有归档里有。
- 快捷键存储键定死为 **`shortcut:bilibiliWebFullscreen`**（`chrome.storage.sync`）；旧键 `shortcutKey` 不再读取。
- `manifest.json` 使用**两条 `content_scripts` entry**：① B站 6 模式 → `hotkey.js`；② B站 2 + YouTube 2 模式 → `content.js`。两条**各自保留原有 `matches`**，不统一 —— 因此 `/cheese/`、`/list/`、`/festival/`、`/medialist/` 与 `http://` 页面只有快捷键生效、没有悬浮窗，**属预期内行为，不是 bug**。
- 工具栏图标与设置页只保留一份（`action` + `options_ui`）。
- **明确不在本次范围**：设置页的"悬浮窗复位"（实测无法生效）、网页全屏×浮窗互斥（待实测）、删除 localStorage 死代码（移入后续拆文件时处理）。详见 PLAN.md §3 与 §7。

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
- `utils.js` 这类带顶层 `const` 的共享脚本**只能出现在一条 `content_scripts` entry** 里。同一扩展在同一 frame 共享一个 isolated world，两条 entry 都列它就会 `Identifier '...' has already been declared`，导致后加载的脚本整体不执行。
- `window.__floatingVideoToolsLoaded` 守卫**隔不住第二个扩展**：不同扩展各有独立的 isolated world。所以**同一个扩展不要从两个路径加载**（两个路径 = 两个 ID = 两份 `content.js` 同时改样式）。旧快捷键扩展本身不含悬浮窗逻辑，与悬浮窗并存无冲突。
- **已核验的扩展 ID 与加载路径**：本机 `Local Extension Settings/` 下的悬浮窗 ID 为 `fkflkkaiaemafmbadbjpehbkpfiigdfk`，唯一匹配路径是 `D:\#GITHUB_melody0709\chrome_pip_mode`（带 `#`）—— 该目录已因改名而不存在，故 Chrome 里登记的这份是失效状态。unpacked 扩展 ID ＝ `SHA256(路径 as UTF-16-LE)` 取前 16 字节映射到 a–p 字母表。按当前路径 `D:\GITHUB_melody0709\chrome_pip_mode\chrome_pip_mode` 重算，新 ID 预计为 `eodmaihkamiiomgcgdeonmhoehiicnhg`。**换 ID ＝ 存储清零。**
- `content.js` 的页面 `localStorage` 分支（`createStorage()` 的 else 分支，`content.js:482-506`）仅在 `chrome.storage.local` 不可用时生效，正常扩展环境永不执行；因此 `getSavedYouTubeGeometry()`（`content.js:320-339`，全工作区仅 `content.js:267` 一处调用）读的是基本不存在的键，属死代码。注意 `resetGeometry()`（`content.js:1270-1280`）只删 chrome 键、**不删页面键**，若页面上有历史残留键，双击复位会被"复活"。
- 更换加载目录会改变 unpacked 扩展 ID（manifest 无 `key` 字段时由路径派生），`chrome.storage.sync` / `storage.local` 随之清零 —— 换 ID 后快捷键与两站几何**全部回默认值，无例外**。几何读取优先级见 `content.js:1699-1702`：当前几何 → chrome 存储的 `savedGeometry` → `site.getDefaultGeometry()`。
- B站「网页全屏」不是 Fullscreen API，`syncPlayer()` 中 `document.fullscreenElement || document.pictureInPictureElement` 的短路（`content.js:1661`）拦不住它。是否需要与悬浮窗做互斥保护，待实测确认后再决定。
- 设置页改 `chrome.storage` **对已打开的标签页无效**：`content.js` 只在初始化读一次存储（`content.js:1746`），且**没有** `chrome.storage.onChanged` 监听，几何状态全在内存变量里。内存值会在拖拽结束（`content.js:1158`）、重新激活（`content.js:1634`）、`beforeunload`（`content.js:1736-1740`）任一触发点写回，把设置页的复位撤销掉。所以悬浮窗复位只能走页面内双击手柄（`content.js:1270`）。
- **本仓库发生过 `.git` 被清空的故障**（2026-09-20，执行 `git checkout` 期间，`.git` 变成 0 个子项；工作区文件未受影响）。恢复靠 `git clone --no-checkout` 远端再把 `.git` 放回，然后 `git reset` 重建索引。因此：**做 git 写操作前，先记录 `git rev-parse HEAD` 与 `git show-ref`**，万一出事可立刻判断有没有本地独有提交丢失。当前远端 `origin/main` = `9540772`。
