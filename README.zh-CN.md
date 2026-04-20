# Floating Video Resizer v1.0.2

[English](README.md) | [Changelog](CHANGELOG.md) | [更新日志](CHANGELOG.zh-CN.md)

这是一个 Chrome 扩展，用来增强 Bilibili 和 YouTube 的悬浮视频体验。

## 功能概览

- 增强站内自带的小窗播放器，支持四个角拖拽缩放。
- 支持 YouTube 的迷你播放器。
- **智能缩放适配**：页面缩放（Ctrl +/-）时保持物理尺寸，视窗拉伸时保持相对比例。
- **多档位宽度比例**：支持四种视窗档位（MAX/WIDE/MEDIUM/SMALL），每个档位独立记忆宽度比例，在不同窗口大小下都能获得最佳观看体验。
- **层级自动穿透**：递归修改父级 `z-index`，确保 Bilibili 小窗不被侧边栏（客服、顶部等）遮挡。

## 主要特性

- 四角缩放手柄放在视频画面外侧，不会压住内容。
- 可以直接拖拽悬浮播放器本体的非控件区域来移动位置。
- 悬浮播放器上方的隐藏拖拽条仍然可用，不会遮挡视频。
- 浏览器窗口尺寸变化时，浮窗会随视窗缩放，并保持右侧和底部的相对停靠位置。
- 缩放时保持原始宽高比。
- 使用 `chrome.storage.local` 持久化保存大小和位置。
- 双击任意角落手柄，可以重置该站点的默认大小和位置。
- 包含新的扩展标识源文件 `assets/logo.svg`，以及打包图标 `assets/icon-128.png`。

## 安装方式

1. 打开 `chrome://extensions`。
2. 开启右上角的开发者模式。
3. 点击“加载已解压的扩展程序”。
4. 选择当前项目文件夹。

## 使用方法

1. 打开任意 Bilibili 或 YouTube 视频页。
2. 触发站内小窗播放器（Bilibili 向下滚动，YouTube 向下滚动或点击迷你播放器按钮）。
3. 从悬浮播放器的非控件区域按住左键拖动，即可移动位置。
4. 拖动任意角上的手柄即可缩放。
5. 如果要恢复默认大小和位置，可以双击顶部拖拽区或任意角落手柄。

## MCP 测试环境

- 推荐的 Chrome DevTools MCP 连接方式：`--browser-url=http://localhost:9222`
- 这台机器上推荐使用以下命令启动测试浏览器：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" \
	--remote-debugging-port=9222 \
	--user-data-dir="D:\Chrome_MCP_Data" \
	--profile-directory="Profile 1" \
	--load-extension="D:\#GITHUB_melody0709\chrome_pip_mode"
```
