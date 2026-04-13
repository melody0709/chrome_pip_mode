# Floating Video Resizer

[English](README.md)

这是一个 Chrome 扩展，用来增强 Bilibili 的悬浮视频体验。

## 功能概览

- 增强站内自带的小窗播放器，支持四个角拖拽缩放。

## 主要特性

- 四角缩放手柄放在视频画面外侧，不会压住内容。
- 可以直接拖拽悬浮播放器本体的非控件区域来移动位置。
- 悬浮播放器上方的隐藏拖拽条仍然可用，不会遮挡视频。
- 缩放时保持原始宽高比。
- 使用 `chrome.storage.local` 持久化保存大小和位置。
- 双击任意角落手柄，可以重置 Bilibili 的默认大小和位置。
- 包含新的扩展标识源文件 `assets/logo.svg`，以及打包图标 `assets/icon-128.png`。

## 安装方式

1. 打开 `chrome://extensions`。
2. 开启右上角的开发者模式。
3. 点击“加载已解压的扩展程序”。
4. 选择当前项目文件夹。

## Bilibili 使用方法

1. 打开任意 Bilibili 视频页。
2. 向下滚动，直到站内小窗播放器出现。
3. 从悬浮播放器的非控件区域按住左键拖动，即可移动位置。
4. 拖动任意角上的手柄即可缩放。
5. 如果要恢复默认大小和位置，可以双击顶部拖拽区或任意角落手柄。

## MCP 测试环境

- 推荐的 Chrome DevTools MCP 连接方式：`--browser-url=http://127.0.0.1:9222`
- 这台机器上推荐使用以下命令启动测试浏览器：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" \
	--remote-debugging-port=9222 \
	--user-data-dir="D:\Chrome_MCP_Data" \
	--profile-directory="Profile 1" \
	--load-extension="D:\#GITHUB_melody0709\chrome_pip_mode"
```
