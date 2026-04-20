# Floating Video Resizer v1.0.2

[简体中文说明](README.zh-CN.md) | [Changelog](CHANGELOG.md) | [更新日志](CHANGELOG.zh-CN.md)

This Chrome extension improves floating video behavior on Bilibili and YouTube.

## What it does

- Enhances the site's built-in floating player and makes it resizable from all four corners.
- Supports YouTube's miniplayer (triggered by scrolling or native button).
- **Intelligent Scaling**: Maintains physical size during page zoom and relative ratio during window resizing.
- **Multi-Tier Width Ratio**: Supports four viewport width tiers (MAX/WIDE/MEDIUM/SMALL), each with independent width ratio memory for optimal viewing experience across different window sizes.
- **Z-Index Correction**: Pierces through site-specific layout constraints (like Bilibili's side nav) to ensure the player is always on top.

## Features

- Four-corner resize handles placed outside the video frame so they do not sit on top of the picture.
- Drag the floating player itself from any non-control area to move it.
- The invisible strip above the floating player also works as a drag zone without covering the video.
- When the browser window is resized, the floating player scales with the viewport while keeping its right and bottom offsets aligned.
- Preserve the original aspect ratio while resizing.
- Persist size and floating position with `chrome.storage.local`.
- Double-click any corner handle to reset to the default site geometry.
- Includes a new extension logo source at `assets/logo.svg` and the packaged icon at `assets/icon-128.png`.

## Load the extension

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this folder.

## Use it

1. Open a Bilibili or YouTube video page.
2. Trigger the floating mini player (scroll down on Bilibili, or scroll/click miniplayer on YouTube).
3. Drag the floating player from a non-control area to move it.
4. Drag any corner handle to resize.
5. Double-click the move strip or a corner handle if you want to reset the size and position.

## MCP Test Setup

- Preferred Chrome DevTools MCP connection: `--browser-url=http://localhost:9222`
- Preferred test browser launch on this machine:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" \
	--remote-debugging-port=9222 \
	--user-data-dir="D:\Chrome_MCP_Data" \
	--profile-directory="Profile 1" \
	--load-extension="D:\#GITHUB_melody0709\chrome_pip_mode"
```
