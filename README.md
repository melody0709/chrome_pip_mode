# Floating Video Resizer

[简体中文说明](README.zh-CN.md)

This Chrome extension improves floating video behavior on Bilibili.

## What it does

- Enhances the site's built-in floating player and makes it resizable from all four corners.

## Features

- Four-corner resize handles placed outside the video frame so they do not sit on top of the picture.
- Drag the floating player itself from any non-control area to move it.
- The invisible strip above the floating player also works as a drag zone without covering the video.
- Preserve the original aspect ratio while resizing.
- Persist size and floating position with `chrome.storage.local`.
- Double-click any corner handle to reset to the default Bilibili geometry.
- Includes a new extension logo source at `assets/logo.svg` and the packaged icon at `assets/icon-128.png`.

## Load the extension

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this folder.

## Use it

1. Open a Bilibili video page.
2. Scroll until the floating mini player appears.
3. Drag the floating player from a non-control area to move it.
4. Drag any corner handle to resize.
5. Double-click the move strip or a corner handle if you want to reset the size and position.

## MCP Test Setup

- Preferred Chrome DevTools MCP connection: `--browser-url=http://127.0.0.1:9222`
- Preferred test browser launch on this machine:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" \
	--remote-debugging-port=9222 \
	--user-data-dir="D:\Chrome_MCP_Data" \
	--profile-directory="Profile 1" \
	--load-extension="D:\#GITHUB_melody0709\chrome_pip_mode"
```
