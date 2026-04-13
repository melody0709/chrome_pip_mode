(() => {
  if (window.__floatingVideoToolsLoaded) {
    return
  }

  window.__floatingVideoToolsLoaded = true

  const ACTIVE_CLASS = "copilot-floating-player-active"
  const BILIBILI_CLASS = "copilot-floating-player-bilibili"
  const OVERLAY_ID = "copilot-floating-player-overlay"
  const OVERLAY_ACTIVE_CLASS = "copilot-floating-player-overlay-active"
  const STYLE_ID = "copilot-floating-player-style"
  const HANDLE_CLASS = "copilot-floating-player-handle"
  const STORAGE_PREFIX = "floatingVideoState:"
  const STORAGE_SCHEMA_VERSION = 3
  const MOVE_ZONE_CLASS = "copilot-floating-player-move-zone"
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
    ".bpx-player-toast-wrap"
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
    "zIndex"
  ]
  const BILIBILI_SIDE_NAV_SELECTOR = ".fixed-sidenav-storage"
  const BILIBILI_DOCK_GAP = 0
  const MARGIN = 1
  const MIN_WIDTH = 480 
  const ABSOLUTE_MIN_WIDTH = 480
  const MAX_VIEWPORT_RATIO = 0.82
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
  let lastViewport = getViewportMetrics()
  const playerInteractionHandlers = new WeakMap()

  function getSiteController() {
    const host = location.hostname

    if (host.includes("bilibili.com")) {
      return createBilibiliController()
    }

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
        const miniWindow = document.querySelector(".mini-player-window.fixed-sidenav-storage-item")
        const miniWarp = document.querySelector(".bpx-player-mini-warp")
        const nativeMiniVisible = [miniWindow, miniWarp].some(
          (element) => element && getComputedStyle(element).display !== "none"
        )

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
      }
    }
  }

  function createStorage(key) {
    if (globalThis.chrome?.storage?.local) {
      return {
        get(callback) {
          globalThis.chrome.storage.local.get([key], (result) => {
            callback(result[key] ?? null)
          })
        },
        set(value) {
          globalThis.chrome.storage.local.set({ [key]: value })
        },
        remove() {
          globalThis.chrome.storage.local.remove(key)
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
      : sourceViewportHeight - top - Math.round(width / getAspectRatio(player))
    const widthRatio = Number.isFinite(Number(value.widthRatio))
      ? Number(value.widthRatio)
      : sourceViewportWidth > 0
        ? width / sourceViewportWidth
        : 0
    const nextWidth = widthRatio > 0 ? viewport.width * widthRatio : width

    return clampGeometry(player, {
      left: viewport.width - right - nextWidth,
      top: viewport.height - bottom - Math.round(nextWidth / getAspectRatio(player)),
      width: nextWidth
    }, viewport)
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

      .${BILIBILI_CLASS} {
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
    `

    document.documentElement.appendChild(style)
  }

  function applyGeometry(player, geometry) {
    const nextGeometry = clampGeometry(player, geometry)
    const currentRect = rectToGeometry(player.getBoundingClientRect())
    const needsRefresh = !player.classList.contains(ACTIVE_CLASS) || !geometryEquals(currentRect, nextGeometry)

    if (needsRefresh) {
      site.applyGeometry(player, nextGeometry)
    }

    currentPlayer = player
    currentGeometry = nextGeometry
    syncOverlay(nextGeometry)
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
      lastViewport = viewport
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