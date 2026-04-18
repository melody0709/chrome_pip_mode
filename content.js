(() => {
  if (window.__floatingVideoToolsLoaded) {
    return
  }

  window.__floatingVideoToolsLoaded = true

  const ACTIVE_CLASS = "copilot-floating-player-active"
  const BILIBILI_CLASS = "copilot-floating-player-bilibili"
  const YOUTUBE_CLASS = "copilot-floating-player-youtube"
  const OVERLAY_ID = "copilot-floating-player-overlay"
  const OVERLAY_ACTIVE_CLASS = "copilot-floating-player-overlay-active"
  const STYLE_ID = "copilot-floating-player-style"
  const HANDLE_CLASS = "copilot-floating-player-handle"
  const STORAGE_PREFIX = "floatingVideoState:"
  const STORAGE_SCHEMA_VERSION = 3
  const MOVE_ZONE_CLASS = "copilot-floating-player-move-zone"
  const CLOSE_CLASS = "copilot-floating-player-close"
  const MOVE_DRAG_THRESHOLD = 6
  const MOVE_EXCLUDE_SELECTOR = [
    "a",
    "button",
    "input",
    "textarea",
    "select",
    "label",
    "[role=button]",
    "[role=link]",
    "[contenteditable=true]",
    ".bpx-player-ctrl-wrap",
    ".bpx-player-control-wrap",
    ".bpx-player-ctrl-bottom",
    ".bpx-player-dialog-wrap",
    ".bpx-player-toast-wrap",
    ".bpx-player-mini-close",
    ".bpx-player-mini-header",
    ".bpx-player-mini-header-left",
    ".bpx-player-mini-header-right",
    ".ytp-chrome-bottom",
    ".ytp-chrome-top",
    ".ytp-miniplayer-ui",
    ".ytp-miniplayer-close-button",
    ".ytp-miniplayer-expand-watch-page-button"
  ].join(", ")
  const PLAYER_STYLE_PROPS = [
    "position",
    "left",
    "top",
    "right",
    "bottom",
    "width",
    "height",
    "maxWidth",
    "maxHeight",
    "zIndex",
    "transform"
  ]
  const BILIBILI_SIDE_NAV_SELECTOR = ".fixed-sidenav-storage"
  const BILIBILI_DOCK_GAP = 0
  const MARGIN = 0
  const MIN_WIDTH = 320
  const ABSOLUTE_MIN_WIDTH = 320
  const MAX_VIEWPORT_RATIO = 0.35
  const PLAYER_Z_INDEX = 2147483646
  const DEFAULT_ASPECT_RATIO = 16 / 9
  const site = getSiteController()

  if (!site) {
    return
  }

  const storage = createStorage(`${STORAGE_PREFIX}${site.id}`)
  const rememberedStyles = new WeakMap()
  const rememberedDefaultGeometry = new WeakMap()

  let overlay = null
  let currentPlayer = null
  let currentGeometry = null
  let savedGeometry = null
  let dragging = null
  let pendingMove = null
  let scheduled = false
  let suppressPlayerClickUntil = 0
  let viewportChangedDuringDrag = false
  let lastViewport = getViewportMetrics()
  const playerInteractionHandlers = new WeakMap()

  function getSiteController() {
    const host = location.hostname

    if (host.includes("bilibili.com")) {
      return createBilibiliController()
    }

    if (host.includes("youtube.com")) {
      return createYouTubeController()
    }

    return null
  }

function createYouTubeController() {
    const SCROLL_THRESHOLD = 256
    let originalRect = null
    const ANCESTOR_OVERFLOW_CLASS = "copilot-floating-ancestor-overflow"
    const ANCESTOR_STACKING_CLASS = "copilot-floating-ancestor-stacking"
    const ancestorSavedStyles = new WeakMap()

    function setAncestorsOverflowVisible(player) {
      let el = player.parentElement
      while (el && el !== document.body) {
        el.classList.add(ANCESTOR_OVERFLOW_CLASS)

        const computed = getComputedStyle(el)
        const saved = {
          position: el.style.position,
          zIndex: el.style.zIndex
        }
        ancestorSavedStyles.set(el, saved)

        if (computed.position === "static") {
          el.classList.add(ANCESTOR_STACKING_CLASS)
        }
        el.style.zIndex = String(PLAYER_Z_INDEX)

        el = el.parentElement
      }
    }

    function clearAncestorsOverflowVisible() {
      document.querySelectorAll(`.${ANCESTOR_OVERFLOW_CLASS}`).forEach(el => {
        el.classList.remove(ANCESTOR_OVERFLOW_CLASS)
        el.classList.remove(ANCESTOR_STACKING_CLASS)

        const saved = ancestorSavedStyles.get(el)
        if (saved) {
          el.style.position = saved.position
          el.style.zIndex = saved.zIndex
          ancestorSavedStyles.delete(el)
        }
      })
    }

    return {
      id: "youtube",
      getPlayer() {
        if (!location.pathname.startsWith("/watch")) return null
        return document.querySelector("#movie_player") || document.querySelector(".html5-video-player")
      },
      shouldFloat(player) {
        if (!player) return false
        if (!location.pathname.startsWith("/watch")) return false
        if (player.classList.contains("ytp-player-minimized")) return false

        const rect = player.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return false

        if (!player.classList.contains(YOUTUBE_CLASS)) {
          originalRect = {
            top: rect.top + globalThis.scrollY,
            bottom: rect.bottom + globalThis.scrollY
          }
        }

        if (!originalRect) return false

        const scrollBottom = globalThis.scrollY + globalThis.innerHeight
        const playerOutOfView = globalThis.scrollY > originalRect.bottom || scrollBottom < originalRect.top
        return playerOutOfView
      },
      getDefaultGeometry(player) {
        const saved = getSavedYouTubeGeometry()
        if (saved) {
          return clampGeometry(player, saved)
        }
        
        const viewport = getViewportMetrics()
        const width = 320
        const height = Math.round(width / DEFAULT_ASPECT_RATIO)
        return clampGeometry(player, {
          left: viewport.width - width - 24,
          top: viewport.height - height - 24,
          width: width
        })
      },
      applyGeometry(player, geometry) {
        const isNewActivation = !player.classList.contains(YOUTUBE_CLASS)

        if (isNewActivation) {
          setAncestorsOverflowVisible(player)
        }

        rememberStyles(player, PLAYER_STYLE_PROPS)
        player.classList.add(ACTIVE_CLASS, YOUTUBE_CLASS)

        player.style.position = "fixed"
        player.style.top = "0"
        player.style.left = "0"
        player.style.right = "auto"
        player.style.bottom = "auto"
        player.style.width = `${geometry.width}px`
        player.style.height = `${geometry.height}px`
        player.style.maxWidth = "100vw"
        player.style.maxHeight = "100vh"
        player.style.zIndex = String(PLAYER_Z_INDEX)
        player.style.transform = `translate(${geometry.left}px, ${geometry.top}px)`
      },
      cleanup(player) {
        player.classList.remove(ACTIVE_CLASS, YOUTUBE_CLASS)
        restoreStyles(player, PLAYER_STYLE_PROPS)
        forgetStyles(player)
        forgetDefaultGeometry(player)
        originalRect = null

        clearAncestorsOverflowVisible()
        globalThis.dispatchEvent(new Event("resize"))
      },
      close(player) {
        globalThis.scrollTo({ top: 0, behavior: 'instant' })
        return false
      }
    }
  }

  function getSavedYouTubeGeometry() {
    try {
      const data = globalThis.localStorage.getItem("floatingVideoState:youtube")
      if (data) {
        const value = JSON.parse(data)
        if (value?.version === STORAGE_SCHEMA_VERSION && Number.isFinite(value.left) && Number.isFinite(value.top) && Number.isFinite(value.width)) {
          return { left: value.left, top: value.top, width: value.width }
        }
      }
    } catch {}
    return null
  }

  function createBilibiliController() {
    return {
      id: "bilibili",
      getPlayer() {
        return document.querySelector(".bpx-player-container")
      },
      shouldFloat(player) {
        if (!player) {
          return false
        }

        const rect = player.getBoundingClientRect()
        const miniWarp = document.querySelector(".bpx-player-mini-warp")
        
        let nativeMiniVisible = false;
        if (miniWarp) {
          nativeMiniVisible = getComputedStyle(miniWarp).display !== "none"
        } else {
          const miniWindow = document.querySelector(".mini-player-window.fixed-sidenav-storage-item")
          nativeMiniVisible = miniWindow && getComputedStyle(miniWindow).display !== "none"
        }

        return nativeMiniVisible && rect.width > 0 && rect.height > 0
      },
      getDefaultGeometry(player) {
        const baseGeometry = rememberDefaultGeometry(player)
        const sideNav = document.querySelector(BILIBILI_SIDE_NAV_SELECTOR)

        if (!sideNav) {
          return baseGeometry
        }

        const sideNavRect = sideNav.getBoundingClientRect()

        if (sideNavRect.width <= 0 || sideNavRect.left <= 0) {
          return baseGeometry
        }

        return clampGeometry(player, {
          left: Math.round(sideNavRect.left - baseGeometry.width - BILIBILI_DOCK_GAP),
          top: baseGeometry.top,
          width: baseGeometry.width
        })
      },
      applyGeometry(player, geometry) {
        rememberStyles(player, PLAYER_STYLE_PROPS)
        player.classList.add(ACTIVE_CLASS, BILIBILI_CLASS)
        player.style.position = "fixed"
        player.style.left = `${geometry.left}px`
        player.style.top = `${geometry.top}px`
        player.style.right = "auto"
        player.style.bottom = "auto"
        player.style.width = `${geometry.width}px`
        player.style.height = `${geometry.height}px`
        player.style.maxWidth = `${geometry.width}px`
        player.style.maxHeight = `${geometry.height}px`
        player.style.zIndex = String(PLAYER_Z_INDEX)
      },
      cleanup(player) {
        player.classList.remove(ACTIVE_CLASS, BILIBILI_CLASS)
        clearStyles(player, PLAYER_STYLE_PROPS)
        forgetStyles(player)
        forgetDefaultGeometry(player)
      },
      close(player) {
        const miniWindow = document.querySelector(".mini-player-window.fixed-sidenav-storage-item")
        if (miniWindow && getComputedStyle(miniWindow).display !== "none") {
          miniWindow.click()
          return true
        }
        
        const miniClose = document.querySelector(
          ".bpx-player-mini-close, .mini-player-window .bpx-player-mini-header-close"
        )
        if (miniClose) {
          miniClose.click()
          return true
        }

        return false
      }
    }
  }

  function isExtensionContextValid() {
    try {
      if (globalThis.chrome?.runtime?.id) {
        return true
      }
    } catch {
      return false
    }
    return false
  }

  function createStorage(key) {
    if (globalThis.chrome?.storage?.local) {
      return {
        get(callback) {
          if (!isExtensionContextValid()) {
            callback(null)
            return
          }
          try {
            globalThis.chrome.storage.local.get([key], (result) => {
              callback(result[key] ?? null)
            })
          } catch {
            callback(null)
          }
        },
        set(value) {
          if (!isExtensionContextValid()) {
            return
          }
          try {
            globalThis.chrome.storage.local.set({ [key]: value })
          } catch {
            return
          }
        },
        remove() {
          if (!isExtensionContextValid()) {
            return
          }
          try {
            globalThis.chrome.storage.local.remove(key)
          } catch {
            return
          }
        }
      }
    }

    return {
      get(callback) {
        try {
          const value = globalThis.localStorage.getItem(key)

          callback(value ? JSON.parse(value) : null)
        } catch {
          callback(null)
        }
      },
      set(value) {
        try {
          globalThis.localStorage.setItem(key, JSON.stringify(value))
        } catch {
          return
        }
      },
      remove() {
        try {
          globalThis.localStorage.removeItem(key)
        } catch {
          return
        }
      }
    }
  }

  function rememberStyles(element, properties) {
    if (!element) {
      return
    }

    let snapshot = rememberedStyles.get(element)

    if (!snapshot) {
      snapshot = {}
      rememberedStyles.set(element, snapshot)
    }

    for (const property of properties) {
      if (!(property in snapshot)) {
        snapshot[property] = element.style[property]
      }
    }
  }

  function clearStyles(element, properties) {
    if (!element) {
      return
    }

    for (const property of properties) {
      element.style[property] = ""
    }
  }

  function restoreStyles(element, properties) {
    if (!element) {
      return
    }

    const snapshot = rememberedStyles.get(element)

    if (!snapshot) {
      clearStyles(element, properties)
      return
    }

    for (const property of properties) {
      element.style[property] = snapshot[property] ?? ""
    }
  }

  function forgetStyles(element) {
    if (!element) {
      return
    }

    rememberedStyles.delete(element)
  }

  function rememberDefaultGeometry(player) {
    if (!player) {
      return null
    }

    let geometry = rememberedDefaultGeometry.get(player)

    if (!geometry) {
      geometry = rectToGeometry(player.getBoundingClientRect())
      rememberedDefaultGeometry.set(player, geometry)
    }

    return geometry
  }

  function forgetDefaultGeometry(player) {
    if (!player) {
      return
    }

    rememberedDefaultGeometry.delete(player)
  }

  function isMoveBlockedTarget(target) {
    return target instanceof Element && Boolean(target.closest(MOVE_EXCLUDE_SELECTOR))
  }

  function clearPendingMove() {
    document.removeEventListener("pointermove", onPendingMove, true)
    document.removeEventListener("pointerup", cancelPendingMove, true)
    document.removeEventListener("pointercancel", cancelPendingMove, true)
    pendingMove = null
  }

  function cancelPendingMove(event) {
    if (!pendingMove) {
      return
    }

    if (event?.pointerId != null && pendingMove.pointerId !== event.pointerId) {
      return
    }

    clearPendingMove()
  }

  function attachPlayerInteractions(player) {
    if (!player || playerInteractionHandlers.has(player)) {
      return
    }

    const onPlayerPointerDown = (event) => {
      if (
        event.button !== 0 ||
        !currentPlayer ||
        currentPlayer !== player ||
        dragging ||
        pendingMove ||
        isMoveBlockedTarget(event.target)
      ) {
        return
      }

      pendingMove = {
        player,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startGeometry: currentGeometry || rectToGeometry(player.getBoundingClientRect()),
        userSelect: document.body.style.userSelect,
        cursor: document.documentElement.style.cursor
      }

      document.addEventListener("pointermove", onPendingMove, true)
      document.addEventListener("pointerup", cancelPendingMove, true)
      document.addEventListener("pointercancel", cancelPendingMove, true)
    }

    const onPlayerClickCapture = (event) => {
      if (performance.now() > suppressPlayerClickUntil) {
        return
      }

      if (isMoveBlockedTarget(event.target)) {
        return
      }

      suppressPlayerClickUntil = 0
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
    }

    player.addEventListener("pointerdown", onPlayerPointerDown, true)
    player.addEventListener("click", onPlayerClickCapture, true)
    playerInteractionHandlers.set(player, { onPlayerPointerDown, onPlayerClickCapture })
  }

  function detachPlayerInteractions(player) {
    if (!player) {
      return
    }

    const handlers = playerInteractionHandlers.get(player)

    if (!handlers) {
      return
    }

    player.removeEventListener("pointerdown", handlers.onPlayerPointerDown, true)
    player.removeEventListener("click", handlers.onPlayerClickCapture, true)
    playerInteractionHandlers.delete(player)
  }

  function safelySetPointerCapture(element, pointerId) {
    try {
      element.setPointerCapture?.(pointerId)
    } catch (error) {
      return
    }
  }

  function safelyReleasePointerCapture(element, pointerId) {
    try {
      element.releasePointerCapture?.(pointerId)
    } catch (error) {
      return
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
  }

  function geometryEquals(leftGeometry, rightGeometry) {
    if (!leftGeometry || !rightGeometry) {
      return false
    }

    return (
      Math.abs(leftGeometry.left - rightGeometry.left) <= 1 &&
      Math.abs(leftGeometry.top - rightGeometry.top) <= 1 &&
      Math.abs(leftGeometry.width - rightGeometry.width) <= 1 &&
      Math.abs(leftGeometry.height - rightGeometry.height) <= 1
    )
  }

  function rectToGeometry(rect) {
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  }

  function getVideo(player) {
    return player?.querySelector("video") || document.querySelector("video")
  }

  function getAspectRatio(player) {
    const video = getVideo(player)

    if (video?.videoWidth && video?.videoHeight) {
      return video.videoWidth / video.videoHeight
    }

    const rect = player?.getBoundingClientRect()

    if (rect?.width > 0 && rect?.height > 0) {
      return rect.width / rect.height
    }

    return DEFAULT_ASPECT_RATIO
  }

  function getViewportMetrics() {
    return {
      width: Math.max(1, globalThis.innerWidth || document.documentElement.clientWidth || 1),
      height: Math.max(1, globalThis.innerHeight || document.documentElement.clientHeight || 1)
    }
  }

  function viewportEquals(leftViewport, rightViewport) {
    if (!leftViewport || !rightViewport) {
      return false
    }

    return leftViewport.width === rightViewport.width && leftViewport.height === rightViewport.height
  }

  function getMaxWidthForViewport(ratio, viewport = getViewportMetrics()) {
    const maxWidth = Math.floor(
      Math.min(
        viewport.width - MARGIN * 2,
        (viewport.height - MARGIN * 2) * ratio,
        viewport.width * MAX_VIEWPORT_RATIO
      )
    )

    return Math.max(ABSOLUTE_MIN_WIDTH, maxWidth)
  }

  function getMinWidthForViewport(ratio, viewport = getViewportMetrics()) {
    return Math.min(MIN_WIDTH, getMaxWidthForViewport(ratio, viewport))
  }

  function clampGeometry(player, geometry, viewport = getViewportMetrics()) {
    const ratio = getAspectRatio(player)
    const width = clamp(
      Math.round(geometry.width),
      getMinWidthForViewport(ratio, viewport),
      getMaxWidthForViewport(ratio, viewport)
    )
    const height = Math.round(width / ratio)
    const maxLeft = Math.max(MARGIN, viewport.width - MARGIN - width)
    const maxTop = Math.max(MARGIN, viewport.height - MARGIN - height)

    return {
      left: clamp(Math.round(geometry.left), MARGIN, maxLeft),
      top: clamp(Math.round(geometry.top), MARGIN, maxTop),
      width,
      height
    }
  }

  function createResponsiveGeometrySnapshot(player, geometry, viewport = getViewportMetrics()) {
    const nextGeometry = clampGeometry(player, geometry, viewport)

    return {
      version: STORAGE_SCHEMA_VERSION,
      left: nextGeometry.left,
      top: nextGeometry.top,
      width: nextGeometry.width,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      right: Math.max(MARGIN, viewport.width - nextGeometry.left - nextGeometry.width),
      bottom: Math.max(MARGIN, viewport.height - nextGeometry.top - nextGeometry.height),
      widthRatio: nextGeometry.width / viewport.width
    }
  }

  function adaptGeometryToViewport(player, value, viewport = getViewportMetrics()) {
    const ratio = getAspectRatio(player)
    const left = Number(value.left)
    const top = Number(value.top)
    const width = Number(value.width)
    const sourceViewportWidth = Number(value.viewportWidth)
    const sourceViewportHeight = Number(value.viewportHeight)
    const right = Number.isFinite(Number(value.right))
      ? Number(value.right)
      : sourceViewportWidth - left - width
    const bottom = Number.isFinite(Number(value.bottom))
      ? Number(value.bottom)
      : sourceViewportHeight - top - Math.round(width / ratio)
    const widthRatio = Number.isFinite(Number(value.widthRatio))
      ? Number(value.widthRatio)
      : sourceViewportWidth > 0
        ? width / sourceViewportWidth
        : 0
    const nextWidth = widthRatio > 0 ? viewport.width * widthRatio : width
    const clampedWidth = clamp(
      Math.round(nextWidth),
      getMinWidthForViewport(ratio, viewport),
      getMaxWidthForViewport(ratio, viewport)
    )
    const clampedHeight = Math.round(clampedWidth / ratio)
    const nextLeft = viewport.width - right - clampedWidth
    const nextTop = viewport.height - bottom - clampedHeight
    const maxLeft = Math.max(MARGIN, viewport.width - MARGIN - clampedWidth)
    const maxTop = Math.max(MARGIN, viewport.height - MARGIN - clampedHeight)

    return {
      left: clamp(Math.round(nextLeft), MARGIN, maxLeft),
      top: clamp(Math.round(nextTop), MARGIN, maxTop),
      width: clampedWidth,
      height: clampedHeight
    }
  }

  function sanitizeSavedGeometry(player, value, viewport = getViewportMetrics()) {
    if (!value || typeof value !== "object") {
      return null
    }

    if (![2, STORAGE_SCHEMA_VERSION].includes(value.version)) {
      return null
    }

    const left = Number(value.left)
    const top = Number(value.top)
    const width = Number(value.width)

    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width)) {
      return null
    }

    if (value.version === STORAGE_SCHEMA_VERSION) {
      const viewportWidth = Number(value.viewportWidth)
      const viewportHeight = Number(value.viewportHeight)

      if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight)) {
        return adaptGeometryToViewport(player, value, viewport)
      }
    }

    return clampGeometry(player, { left, top, width }, viewport)
  }

  function persistGeometry(geometry) {
    if (!currentPlayer) {
      return
    }

    savedGeometry = createResponsiveGeometrySnapshot(currentPlayer, geometry)
    storage.set(savedGeometry)
  }

  function hideOverlay() {
    if (!overlay) {
      return
    }

    overlay.classList.remove(OVERLAY_ACTIVE_CLASS)
  }

  function syncOverlay(geometry) {
    const nextOverlay = ensureOverlay()

    nextOverlay.style.left = `${geometry.left}px`
    nextOverlay.style.top = `${geometry.top}px`
    nextOverlay.style.width = `${geometry.width}px`
    nextOverlay.style.height = `${geometry.height}px`
    nextOverlay.classList.add(OVERLAY_ACTIVE_CLASS)
  }

  function getCornerCursor(corner) {
    return corner === "top-left" || corner === "bottom-right" ? "nwse-resize" : "nesw-resize"
  }

  function getMaxDragWidth(startGeometry, corner, ratio) {
    const maxByWidth = corner.endsWith("left")
      ? startGeometry.left + startGeometry.width - MARGIN
      : getViewportMetrics().width - MARGIN - startGeometry.left
    const maxByHeight = corner.startsWith("top")
      ? (startGeometry.top + startGeometry.height - MARGIN) * ratio
      : (getViewportMetrics().height - MARGIN - startGeometry.top) * ratio

    return Math.max(
      getMinWidthForViewport(ratio),
      Math.floor(Math.min(maxByWidth, maxByHeight, getMaxWidthForViewport(ratio)))
    )
  }

  function computeDragGeometry(event) {
    const { corner, ratio, startX, startY, startGeometry } = dragging
    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY
    const horizontalDirection = corner.endsWith("right") ? 1 : -1
    const verticalDirection = corner.startsWith("bottom") ? 1 : -1
    const widthFromX = startGeometry.width + deltaX * horizontalDirection
    const widthFromY = startGeometry.width + deltaY * ratio * verticalDirection
    const maxWidth = getMaxDragWidth(startGeometry, corner, ratio)
    const width = clamp(
      Math.round(Math.abs(deltaX) >= Math.abs(deltaY * ratio) ? widthFromX : widthFromY),
      getMinWidthForViewport(ratio),
      maxWidth
    )
    const height = Math.round(width / ratio)
    const left = corner.endsWith("left")
      ? startGeometry.left + (startGeometry.width - width)
      : startGeometry.left
    const top = corner.startsWith("top")
      ? startGeometry.top + (startGeometry.height - height)
      : startGeometry.top

    return clampGeometry(currentPlayer, { left, top, width })
  }

  function computeMoveGeometry(event) {
    const { startX, startY, startGeometry } = dragging

    return clampGeometry(currentPlayer, {
      left: startGeometry.left + (event.clientX - startX),
      top: startGeometry.top + (event.clientY - startY),
      width: startGeometry.width
    })
  }

  function startMoveDragging(event) {
    if (!pendingMove || !currentPlayer || pendingMove.player !== currentPlayer) {
      clearPendingMove()
      return
    }

    const move = pendingMove

    dragging = {
      mode: "move",
      pointerId: event.pointerId,
      handle: move.player,
      startX: move.startX,
      startY: move.startY,
      startGeometry: move.startGeometry,
      userSelect: move.userSelect,
      cursor: move.cursor
    }

    safelySetPointerCapture(move.player, event.pointerId)
    document.body.style.userSelect = "none"
    document.documentElement.style.cursor = "grabbing"
    suppressPlayerClickUntil = performance.now() + 400
    clearPendingMove()
    document.addEventListener("pointermove", onPointerMove, true)
    document.addEventListener("pointerup", stopDragging, true)
    document.addEventListener("pointercancel", stopDragging, true)
    applyGeometry(currentPlayer, computeMoveGeometry(event))
  }

  function stopDragging(event) {
    if (!dragging) {
      return
    }

    if (event?.pointerId != null && dragging.pointerId !== event.pointerId) {
      return
    }

    if (event?.pointerId != null) {
      safelyReleasePointerCapture(dragging.handle, event.pointerId)
    }

    document.removeEventListener("pointermove", onPointerMove, true)
    document.removeEventListener("pointerup", stopDragging, true)
    document.removeEventListener("pointercancel", stopDragging, true)
    document.body.style.userSelect = dragging.userSelect
    document.documentElement.style.cursor = dragging.cursor
    persistGeometry(currentGeometry)
    dragging = null

    if (viewportChangedDuringDrag) {
      viewportChangedDuringDrag = false
      scheduleSync()
    }
  }

  function onPointerMove(event) {
    if (!dragging || !currentPlayer) {
      return
    }

    if (event.pointerId !== dragging.pointerId) {
      return
    }

    event.preventDefault()
    applyGeometry(
      currentPlayer,
      dragging.mode === "move" ? computeMoveGeometry(event) : computeDragGeometry(event)
    )
  }

  function onPendingMove(event) {
    if (!pendingMove || !currentPlayer || pendingMove.player !== currentPlayer) {
      clearPendingMove()
      return
    }

    if (event.pointerId !== pendingMove.pointerId) {
      return
    }

    const deltaX = event.clientX - pendingMove.startX
    const deltaY = event.clientY - pendingMove.startY

    if (Math.abs(deltaX) < MOVE_DRAG_THRESHOLD && Math.abs(deltaY) < MOVE_DRAG_THRESHOLD) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    startMoveDragging(event)
  }

  function onMoveZonePointerDown(event) {
    if (event.button !== 0 || !currentPlayer) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const handle = event.currentTarget

    dragging = {
      mode: "move",
      pointerId: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: currentGeometry || rectToGeometry(currentPlayer.getBoundingClientRect()),
      userSelect: document.body.style.userSelect,
      cursor: document.documentElement.style.cursor
    }

    safelySetPointerCapture(handle, event.pointerId)
    document.body.style.userSelect = "none"
    document.documentElement.style.cursor = "grabbing"
    document.addEventListener("pointermove", onPointerMove, true)
    document.addEventListener("pointerup", stopDragging, true)
    document.addEventListener("pointercancel", stopDragging, true)
  }

  function onHandlePointerDown(event) {
    if (event.button !== 0 || !currentPlayer) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const handle = event.currentTarget
    const corner = handle.dataset.corner
    const startGeometry = currentGeometry || rectToGeometry(currentPlayer.getBoundingClientRect())

    dragging = {
      mode: "resize",
      pointerId: event.pointerId,
      handle,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry,
      ratio: getAspectRatio(currentPlayer),
      userSelect: document.body.style.userSelect,
      cursor: document.documentElement.style.cursor
    }

    safelySetPointerCapture(handle, event.pointerId)
    document.body.style.userSelect = "none"
    document.documentElement.style.cursor = getCornerCursor(corner)
    document.addEventListener("pointermove", onPointerMove, true)
    document.addEventListener("pointerup", stopDragging, true)
    document.addEventListener("pointercancel", stopDragging, true)
  }

  function resetGeometry() {
    savedGeometry = null
    storage.remove()

    if (!currentPlayer) {
      return
    }

    currentGeometry = null
    applyGeometry(currentPlayer, site.getDefaultGeometry(currentPlayer))
  }

  function onHandleDoubleClick(event) {
    event.preventDefault()
    event.stopPropagation()
    resetGeometry()
  }

  function onCloseButtonClick(event) {
    event.preventDefault()
    event.stopPropagation()

    let closedNatively = false
    if (site.close) {
      closedNatively = site.close(currentPlayer)
    }

    if (!closedNatively) {
      deactivateCurrentPlayer()
    }
  }

  function ensureOverlay() {
    if (overlay) {
      return overlay
    }

    overlay = document.getElementById(OVERLAY_ID)

    if (!overlay) {
      overlay = document.createElement("div")
      overlay.id = OVERLAY_ID

      for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
        const handle = document.createElement("div")
        handle.className = HANDLE_CLASS
        handle.dataset.corner = corner
        handle.setAttribute("aria-hidden", "true")
        handle.addEventListener("pointerdown", onHandlePointerDown)
        handle.addEventListener("dblclick", onHandleDoubleClick)
        overlay.appendChild(handle)
      }

      document.documentElement.appendChild(overlay)
    }

    if (!overlay.querySelector(`.${MOVE_ZONE_CLASS}`)) {
      const moveZone = document.createElement("div")
      moveZone.className = MOVE_ZONE_CLASS
      moveZone.setAttribute("aria-hidden", "true")
      moveZone.addEventListener("pointerdown", onMoveZonePointerDown)
      moveZone.addEventListener("dblclick", onHandleDoubleClick)
      overlay.appendChild(moveZone)
    }

    if (!overlay.querySelector(`.${CLOSE_CLASS}`)) {
      const closeBtn = document.createElement("div")
      closeBtn.className = CLOSE_CLASS
      closeBtn.setAttribute("role", "button")
      closeBtn.setAttribute("aria-label", "Close floating player")
      closeBtn.setAttribute("tabindex", "0")
      closeBtn.addEventListener("click", onCloseButtonClick)
      overlay.appendChild(closeBtn)
    }

    for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
      if (overlay.querySelector(`.${HANDLE_CLASS}[data-corner="${corner}"]`)) {
        continue
      }

      const handle = document.createElement("div")
      handle.className = HANDLE_CLASS
      handle.dataset.corner = corner
      handle.setAttribute("aria-hidden", "true")
      handle.addEventListener("pointerdown", onHandlePointerDown)
      handle.addEventListener("dblclick", onHandleDoubleClick)
      overlay.appendChild(handle)
    }

    return overlay
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return
    }

    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        display: none;
        pointer-events: none;
        overflow: visible;
        z-index: 2147483647;
      }

      #${OVERLAY_ID}.${OVERLAY_ACTIVE_CLASS} {
        display: block;
      }

      #${OVERLAY_ID} .${MOVE_ZONE_CLASS} {
        position: absolute;
        left: 0;
        top: -16px;
        width: 100%;
        height: 16px;
        pointer-events: auto;
        cursor: grab;
      }

      #${OVERLAY_ID} .${MOVE_ZONE_CLASS}:active {
        cursor: grabbing;
      }

      #${OVERLAY_ID} .${CLOSE_CLASS} {
        position: absolute;
        right: -10px;
        top: -10px;
        width: 24px;
        height: 24px;
        pointer-events: auto;
        cursor: pointer;
        opacity: 0;
        transition: opacity 120ms ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
      }

      #${OVERLAY_ID} .${CLOSE_CLASS}:hover,
      #${OVERLAY_ID} .${CLOSE_CLASS}:active {
        opacity: 0.95;
        background: rgba(0, 0, 0, 0.8);
      }

      #${OVERLAY_ID} .${CLOSE_CLASS}::before,
      #${OVERLAY_ID} .${CLOSE_CLASS}::after {
        content: "";
        position: absolute;
        width: 12px;
        height: 2px;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 999px;
      }

      #${OVERLAY_ID} .${CLOSE_CLASS}::before {
        transform: rotate(45deg);
      }

      #${OVERLAY_ID} .${CLOSE_CLASS}::after {
        transform: rotate(-45deg);
      }

      #${OVERLAY_ID} .${HANDLE_CLASS} {
        position: absolute;
        width: 24px;
        height: 24px;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 120ms ease;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}:hover,
      #${OVERLAY_ID} .${HANDLE_CLASS}:active {
        opacity: 0.95;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}::before,
      #${OVERLAY_ID} .${HANDLE_CLASS}::after {
        content: "";
        position: absolute;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
        border-radius: 999px;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="top-left"] {
        left: -10px;
        top: -10px;
        cursor: nwse-resize;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="top-left"]::before {
        left: 0;
        top: 0;
        width: 2px;
        height: 14px;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="top-left"]::after {
        left: 0;
        top: 0;
        width: 14px;
        height: 2px;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="top-right"] {
        right: -10px;
        top: -10px;
        cursor: nesw-resize;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="top-right"]::before {
        right: 0;
        top: 0;
        width: 2px;
        height: 14px;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="top-right"]::after {
        right: 0;
        top: 0;
        width: 14px;
        height: 2px;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="bottom-left"] {
        left: -10px;
        bottom: -10px;
        cursor: nesw-resize;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="bottom-left"]::before {
        left: 0;
        bottom: 0;
        width: 2px;
        height: 14px;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="bottom-left"]::after {
        left: 0;
        bottom: 0;
        width: 14px;
        height: 2px;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="bottom-right"] {
        right: -10px;
        bottom: -10px;
        cursor: nwse-resize;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="bottom-right"]::before {
        right: 0;
        bottom: 0;
        width: 2px;
        height: 14px;
      }

      #${OVERLAY_ID} .${HANDLE_CLASS}[data-corner="bottom-right"]::after {
        right: 0;
        bottom: 0;
        width: 14px;
        height: 2px;
      }

      .${BILIBILI_CLASS}, .${YOUTUBE_CLASS} {
        isolation: isolate;
      }

      .${BILIBILI_CLASS} .bpx-player-primary-area,
      .${BILIBILI_CLASS} .bpx-player-video-area,
      .${BILIBILI_CLASS} .bpx-player-video-wrap,
      .${BILIBILI_CLASS} .bpx-player-video-perch,
      .${BILIBILI_CLASS} .bpx-player-video-wrap > div,
      .${BILIBILI_CLASS} video {
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
      }

#movie_player.${YOUTUBE_CLASS} {
        position: fixed !important;
        z-index: 2147483647 !important;
        top: 0 !important;
        left: 0 !important;
        background: #000 !important;
        box-shadow: rgba(0, 0, 0, .4) 0 2px 8px !important;
        will-change: transform, width, height !important;
      }

      #movie_player.${YOUTUBE_CLASS} .html5-video-container {
        width: 100% !important;
        height: 100% !important;
      }

      #movie_player.${YOUTUBE_CLASS} video {
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        top: 0 !important;
        left: 0 !important;
        object-fit: contain !important;
      }

      #movie_player.${YOUTUBE_CLASS} .ytp-chrome-bottom {
        width: calc(100% - 24px) !important;
      }

      #movie_player.${YOUTUBE_CLASS} .ytp-miniplayer-button,
      #movie_player.${YOUTUBE_CLASS} .ytp-size-button {
        display: none !important;
      }

      .copilot-floating-ancestor-overflow {
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
        contain: none !important;
      }

      .copilot-floating-ancestor-stacking {
        position: relative !important;
      }
    `

    document.documentElement.appendChild(style)
  }

  function applyGeometry(player, geometry) {
    const nextGeometry = clampGeometry(player, geometry)
    const currentRect = rectToGeometry(player.getBoundingClientRect())
    const isNewActivation = !player.classList.contains(ACTIVE_CLASS)
    const needsRefresh = isNewActivation || !geometryEquals(currentRect, nextGeometry)

    if (needsRefresh) {
      site.applyGeometry(player, nextGeometry)
    }

    currentPlayer = player
    currentGeometry = nextGeometry
    syncOverlay(nextGeometry)

    if (isNewActivation) {
      persistGeometry(nextGeometry)
    }
  }

  function deactivateCurrentPlayer() {
    clearPendingMove()
    suppressPlayerClickUntil = 0

    if (dragging) {
      stopDragging()
    }

    if (currentPlayer) {
      detachPlayerInteractions(currentPlayer)
      site.cleanup(currentPlayer)
    }

    currentPlayer = null
    currentGeometry = null
    hideOverlay()
  }

  function syncPlayer() {
    scheduled = false
    const viewport = getViewportMetrics()
    const viewportChanged = !viewportEquals(lastViewport, viewport)

    if (document.fullscreenElement || document.pictureInPictureElement) {
      lastViewport = viewport
      deactivateCurrentPlayer()
      return
    }

    if (dragging) {
      viewportChangedDuringDrag = true
      return
    }

    const player = site.getPlayer()

    if (!player || !site.shouldFloat(player)) {
      lastViewport = viewport
      deactivateCurrentPlayer()
      return
    }

    if (currentPlayer && currentPlayer !== player) {
      detachPlayerInteractions(currentPlayer)
      site.cleanup(currentPlayer)
      currentPlayer = null
      currentGeometry = null
    }

    const responsiveCurrentGeometry =
      currentPlayer === player && currentGeometry && viewportChanged
        ? adaptGeometryToViewport(
            player,
            createResponsiveGeometrySnapshot(player, currentGeometry, lastViewport),
            viewport
          )
        : currentGeometry

    const geometry =
      (currentPlayer === player && responsiveCurrentGeometry) ||
      sanitizeSavedGeometry(player, savedGeometry, viewport) ||
      site.getDefaultGeometry(player)

    applyGeometry(player, geometry)

    if (savedGeometry && viewportChanged) {
      savedGeometry = createResponsiveGeometrySnapshot(player, currentGeometry, viewport)
    }

    lastViewport = viewport
    attachPlayerInteractions(player)
  }

  function scheduleSync() {
    if (scheduled) {
      return
    }

    scheduled = true
    globalThis.requestAnimationFrame(syncPlayer)
  }

  function installObservers() {
    const observer = new MutationObserver(scheduleSync)

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"]
    })

    globalThis.addEventListener("scroll", scheduleSync, { capture: true, passive: true })
    globalThis.addEventListener("resize", scheduleSync, { passive: true })
    globalThis.addEventListener("hashchange", scheduleSync)
    globalThis.addEventListener("popstate", scheduleSync)
    globalThis.visualViewport?.addEventListener("resize", scheduleSync, { passive: true })
  }

  ensureStyles()
  ensureOverlay()
  installObservers()
  storage.get((value) => {
    if ([2, STORAGE_SCHEMA_VERSION].includes(value?.version)) {
      savedGeometry = value
    } else {
      savedGeometry = null

      if (value) {
        storage.remove()
      }
    }

    scheduleSync()
  })
  scheduleSync()
})()