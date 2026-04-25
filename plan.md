# Floating Video Resizer — Code Review & 改进计划

## 一、Bug 分析

### 1. [严重] YouTube 初始浮窗位置闪烁 | `content.js:219-310`
`createYouTubeController()` 中 `getDefaultGeometry` 会先调用 `getSavedYouTubeGeometry()` 读 localStorage。
但 `storage.get()` 是异步的，`scheduleSync()` 在 `storage.get` 回调内和回调外各调用了一次（`content.js:1698-1712`）。回调外的 `scheduleSync()` 可能早于回调执行，导致首次渲染时 `savedGeometry` 仍为 `null`，玩家先被放置在默认位置，然后回调触发后又被重新定位到存储位置——造成**视觉上的位置跳动**。

**修复建议**：删除 1712 行的裸 `scheduleSync()`，只保留回调内的调用；或者在初始化完成前设置一个 `initialized` 标志避免重复渲染。

### 2. [中等] `resetGeometry()` 未触发重新同步 | `content.js:1223-1233`
调用 `resetGeometry()` 后直接执行 `applyGeometry`，但不会重新调用 `scheduleSync()`（因为 `applyGeometry` 不触发 observer / 事件）。这意味着如果 `resetGeometry` 的执行改变了 DOM 状态，外部 observer 不会感知。虽然目前直接调用 `applyGeometry` 本身可以完成重绘，但 `savedGeometry` 在内存中设为 `null` 而 storage 异步 remove 可能还未完成——如果此时触发 `scheduleSync`（如 resize），`sanitizeSavedGeometry(player, null)` 会降级到 `getDefaultGeometry`，符合预期，**风险低**。

### 3. [中等] `getCornerCursor()` corner 拼写检查严格匹配 | `content.js:993-995`
仅检查 `"top-left"` 和 `"bottom-right"` 返回 `nwse-resize`，其他都返回 `nesw-resize`。如果 corner 值因任何原因变为意外字符串（如空串、undefined），会错误地返回 `nesw-resize`。当前代码中 corner 值由 `ensureOverlay()` 硬编码设置，**运行时风险极低**。

### 4. [低] `clampGeometry` 潜在的 NaN 传播 | `content.js:763-797`
```js
const width = clamp(Math.round(geometry.width), getMinWidthForViewport(...), getMaxWidthForViewport(...))
```
如果 `geometry.width` 为 `undefined` 或 `NaN`，`Math.round(NaN)` 返回 `NaN`，`clamp` 中 `Math.min/max` 对 NaN 返回 NaN，width 变为 NaN，导致 `width / ratio` 也是 NaN，最终 geometry.left/top 的 clamp 也可能传播 NaN。当前调用栈中 geometry.width 始终由上游保证是有效数字，但**缺少防御性检查**。

---

## 二、性能问题

### 1. [高] MutationObserver 粒度过粗 | `content.js:1672-1679`
```js
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] })
```
监听整个 `document.documentElement` 的 `subtree` 变更，意味着**每一个 DOM 节点的 class/style/hidden 变化都会触发 `scheduleSync`**。Bilibili/YouTube 页面 DOM 变更极其频繁（弹幕、评论区加载、广告插入等），会导致大量无效的 `scheduleSync` 调用。

**修复建议**：
- 缩小 observer 范围到 player 容器及其关键祖先节点
- `scheduleSync` 中增加快速路径检测：如果 player 不存在且上次也为 null，直接 return（当前已部分实现但可优化）
- 考虑用 `requestIdleCallback` 代替 `requestAnimationFrame` 降低优先级

### 2. [中] `requestAnimationFrame` 内频繁 `getComputedStyle` | `content.js:151,166`
`setAncestorsOverflowVisible()` 在每个祖先节点上调用 `getComputedStyle(el)`。虽然只在激活/关闭时触发（非高频路径），但如果玩家被嵌套在深层 DOM 中（YouTube 常见），可能触发 5-10 次 layout。

**修复建议**：可接受当前设计（非热路径），但可考虑缓存结果。

### 3. [中] `persistGeometry` 500ms 防抖可能与 `beforeunload` 冲突 | `content.js:964-973,1688-1692`
`persistGeometry` 是 500ms 防抖版本，拖拽过程中频繁调用防抖版本。`beforeunload` 中调用 `persistGeometryImmediate` 立即保存。但如果拖拽刚结束不到 500ms 用户就关闭页面，最后一次位置**可能丢失**。

**修复建议**：在 `stopDragging` 中直接调用 `persistGeometryImmediate` 而非 `persistGeometry`（当前 `stopDragging` 第 1111 行调用的是 `persistGeometry(currentGeometry)`——这是防抖版本！DANGER）。

### ⚠️ 4. [重大发现] `stopDragging` 中使用防抖而非立即持久化 | `content.js:1111`
```js
persistGeometry(currentGeometry)  // 这是 500ms 防抖版本！
```
拖拽结束后如果用户在 500ms 内关闭标签页，最后拖拽的几何位置将**永久丢失**。`beforeunload` handler 仅保存 `currentGeometry` 的快照，但需要 `currentPlayer` 非 null——这个条件可能满足，但依赖时序。

**修复建议**：`stopDragging` 中改为 `persistGeometryImmediate(currentGeometry)`。

---

## 三、兜底 & 容错

### 1. [中] extension context 失效后的事件监听器未清理
`isExtensionContextValid()` 在 `createStorage()` 中用于判断 `chrome.storage` 是否可用。如果 extension 被卸载/重载，`chrome.runtime.id` 变为 undefined，storage 操作被静默跳过。但是 **MutationObserver、scroll、resize 等事件监听器不会被移除**，导致 `scheduleSync` 继续触发，applyGeometry 照常执行（因为不依赖 extension API）。这是部分正确的行为（PIP 功能继续工作，只是不能持久化）——**符合预期**。

### 2. [低] `safelySetPointerCapture` / `safelyReleasePointerCapture` 静默失败
尝试设置指针捕获失败时静默 catch。如果浏览器不支持 pointer capture（极老环境），拖拽将完全失效，但没有用户可见的错误提示。**可接受**。

### 3. [中] YouTube `originalRect` 只被计算一次 | `content.js:237-242`
`originalRect` 在 player 首次进入 `shouldFloat` 检查时被设置，之后永不清零（除了 `cleanup` 时）。如果用户在滚动过程中发生了任何改变 player 原始位置的 DOM 操作（如评论区折叠/展开改变页面高度），`originalRect` 可能变得过时，导致浮窗触发条件错误。

**修复建议**：每次 player 非浮窗状态时定时刷新 `originalRect`，或在特定事件（如 resize、DOM 突变导致评论区高度变化）时重新计算。

### 4. [低] `sanitizeSavedGeometry` 版本 6 未处理缺少 `viewportWidth` 的情况 | `content.js:927-935`
```js
if (value.version === 6) {
    const viewportWidth = Number(value.viewportWidth)
    const viewportHeight = Number(value.viewportHeight)
    if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight)) {
        return adaptGeometryToViewport(player, value, viewport)
    }
}
```
如果 `viewportWidth` 无效，代码直接落入 `return null`（因为后面的 `value.version === 3/4/5` 分支不匹配）。这意味着一个"损坏"的版本 6 数据会被**静默丢弃**，没有降级到默认几何的迁移路径。

**修复建议**：添加 fallback 到 `getDefaultGeometry` 或尝试用旧逻辑降级。

### 5. [中] `clearAncestorsOverflowVisible()` 使用全局 DOM 查询 | `content.js:167-179`
```js
document.querySelectorAll(`.${ANCESTOR_OVERFLOW_CLASS}`)
```
这会清除**所有**被标记的祖先节点，包括那些可能属于其他 player 实例的节点。单页应用中目前只有一个 player，但如果将来扩展到多个 player，会产生交叉污染。**当前单 player 设计下安全**。

### 6. [低] `rememberStyles` 只保存第一次快照 | `content.js:502-519`
```js
if (!(property in snapshot)) {
    snapshot[property] = element.style[property]
}
```
只保存第一次调用时的 style 值。如果 player 的 style 在 `rememberStyles` 之后又被外部修改（不太可能但理论上存在），恢复时会恢复错误的旧值。

**修复建议**：应考虑在反复激活/停用场景中是否每次都重新 snapshot。当前场景下（一次激活后持续到关闭），**无实际问题**。

---

## 四、代码质量 & 可维护性

### 1. [中] content.js 长度达 1713 行，单文件架构
所有逻辑压缩在一个 IIFE 中。策略模式（site controller）部分隔离，但工具函数、状态管理、DOM 操作混杂。

**改进建议**：
- 拆分为 `storage.js`、`geometry.js`、`overlay.js`、`observers.js` 等模块（注意：Chrome Extension 仅支持单文件 content script，需要 build 工具打包，违反 AGENTS.md 约束，因此现阶段不可行。
- 如果不想引入构建工具，可以更多使用注释分区 + 逻辑分段

### 2. [低] 缩进不一致
`content.js` 中部分函数缩进为 2 空格（如 `createYouTubeController` 返回对象），`computeMoveGeometry` 前面有额外的缩进。不影响运行但影响可读性。

### 3. [低] `check_screen.js` 和 `read_storage_hex.js` 中的档位阈值与 `content.js` 不一致
- `check_screen.js:93-95`: tier 划分使用 `0.85`, `0.70`, `0.55`（其中 `0.55` 与 content.js 的 `0.50` 不同！）
- `VIEWPORT_TIERS.MEDIUM.min` 为 `0.50`，但 `check_screen.js` 使用 `0.55`

这两个辅助脚本仅用于调试/数据分析，不影响正式功能，但阈值不一致会在调试时产生困惑。

---

## 五、边界情况 & 风险

### 1. [中] 极小视口（viewport 宽度 < 480px）
`ABSOLUTE_MIN_WIDTH = 480`，`getEffectiveMinWidth()` 返回 `Math.floor(480 / devicePixelRatio)`。在高 DPI 屏幕上（如 DPR=2），minWidth = 240px。如果 viewport 本身宽度 < 240px（折叠屏手机等），所有 clamp 计算可能产生 width > viewport.width 的情况。当前 `clampGeometry` 通过 `getMaxWidthForViewport` 限制 `viewport.width * 0.5`，可缓解，但极端情况下仍有溢出风险。

### 2. [低] 缩放导致 player 不可见
如果用户在激活浮窗后大幅改变页面缩放（Ctrl+鼠标滚轮），`adaptGeometryToViewport` 通过 `zoomRatio` 缩放坐标。但由于 `clampGeometry` 的 maxWidth 限制为 `viewport.width * 0.5`，缩放后 player 可能被 clamp 到极小或跑到屏幕外。用户会感知为"浮窗消失了"。

**修复建议**：在 `scheduleSync` 检测到异常 geometry（如 left + width > viewport.width + 50）时强制重置为默认位置。

### 3. [中] Bilibili mini-player 关闭使用模拟 click | `content.js:405-421`
`close()` 通过选择器查找关闭按钮并 `.click()`。如果 Bilibili 更新了关闭按钮的 DOM 结构或绑定了不同的事件处理方式，关闭功能将失效。**强依赖外部 DOM 结构，脆弱**。

**修复建议**：添加多重备选方案或定时检测关闭是否成功（超时未关闭则强制 deactivate）。

### 4. [低] YouTube `manuallyClosed` 标志只在 `playerOutOfView=false` 时重置 | `content.js:249-251`
```js
if (!playerOutOfView) {
    manuallyClosed = false
}
```
如果用户手动关闭浮窗后**立刻**滚动回原始位置（在同一个 `scheduleSync` 周期内），标志被重置，浮窗立即重新激活。用户可能需要点击两次关闭。**体验瑕疵**。

**修复建议**：在 `manuallyClosed` 重置后加一个短暂冷却期。

---

## 六、改进优先级排序

| 优先级 | 问题 | 影响 | 修复难度 |
|--------|------|------|----------|
| **P0** | stopDragging 使用防抖持久化(1.4) | 拖拽后立即关闭页面会丢失位置 | 1 行修改 |
| **P1** | 初始化双 sync 导致闪烁(1.1) | 用户看到位置跳动 | 1 行修改 |
| **P1** | MutationObserver 监听范围过大(2.1) | 持续 CPU 消耗、影响电池 | 中等改造 |
| **P2** | YouTube originalRect 不刷新(3.3) | 特定场景浮窗不出现/不该出现时出现 | 中等改造 |
| **P2** | Bilibili close 强依赖外部 DOM(5.3) | B站更新后关闭功能失效 | 中等改造 |
| **P3** | 版本6损坏数据无降级(3.4) | 极罕见场景（数据损坏） | 数行修改 |
| **P3** | 缩进不一致、阈值不一致(4.2/4.3) | 可读性/调试困惑 | 低 |

---

## 七、总结

代码整体**架构合理**（策略模式 + 集中状态管理），核心功能**稳定**。主要风险集中在：
1. **持久化时序问题**（P0/P1 bug）
2. **性能持续消耗**（MutationObserver 大范围监听）
3. **外部依赖脆弱性**（Bilibili DOM 结构强依赖）

建议优先修复 P0 和 P1 问题（共 2 行修改），然后逐步处理 P2 问题。
