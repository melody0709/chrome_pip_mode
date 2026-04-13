# Floating Video Resizer

[简体中文说明](README.zh-CN.md)

This Chrome extension improves floating video behavior on Bilibili and YouTube.

## What it does

- Bilibili: enhances the site's built-in floating player and makes it resizable from all four corners.
- YouTube: creates an automatic floating mini-player on watch pages after the main player has scrolled off-screen and the comments area is reached.

## Notes about YouTube

This extension implements a page-level floating mini-player effect on YouTube. It does not force Chrome's system Picture-in-Picture window, because that API is not reliable for scroll-triggered automatic entry without a direct user gesture.

## Features

- Four-corner resize handles placed outside the video frame so they do not sit on top of the picture.
- Drag the floating player itself from any non-control area to move it.
- The invisible strip above the floating player also works as a drag zone without covering the video.
- Preserve the original aspect ratio while resizing.
- Persist size and floating position with `chrome.storage.local`.
- Double-click any corner handle to reset to the default geometry for the current site.
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

## YouTube behavior

1. Open a YouTube watch page.
2. Scroll down until the main player is off-screen and the comments area is in view.
3. The player will dock as a floating mini-player near the bottom-right of the viewport.
4. Drag any corner handle to resize, or scroll back up to return it to the page layout.