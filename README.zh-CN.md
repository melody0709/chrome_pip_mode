# Floating Video Resizer

[English](README.md)

这是一个 Chrome 扩展，用来增强 Bilibili 和 YouTube 的悬浮视频体验。

## 功能概览

- Bilibili：增强站内自带的小窗播放器，支持四个角拖拽缩放。
- YouTube：在 `watch` 页面中，当主播放器滚出视口且评论区进入可视范围后，自动切换为页面内悬浮小窗。

## 关于 YouTube 的说明

这个扩展在 YouTube 上实现的是“页面内悬浮小窗”效果，不是强制调用 Chrome 系统级画中画窗口。原因是系统级 PiP API 对“滚动触发自动进入”这类场景并不稳定，而且通常要求明确的用户手势。

## 主要特性

- 四角缩放手柄放在视频画面外侧，不会压住内容。
- 可以直接拖拽悬浮播放器本体的非控件区域来移动位置。
- 悬浮播放器上方的隐藏拖拽条仍然可用，不会遮挡视频。
- 缩放时保持原始宽高比。
- 使用 `chrome.storage.local` 持久化保存大小和位置。
- 双击任意角落手柄，可以重置当前站点的默认大小和位置。
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

## YouTube 行为说明

1. 打开任意 YouTube `watch` 页面。
2. 向下滚动，直到主播放器离开视口，同时评论区进入可视范围。
3. 播放器会停靠到视口右下角附近，变成悬浮小窗。
4. 可以拖动角落手柄缩放；向上滚回播放器区域后，会回到页面原始布局中。