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
  const STORAGE_SCHEMA_VERSION = 6

  // 视窗档位配置（基于窗口宽度与屏幕可用宽度的比例）
  const VIEWPORT_TIERS = {
    MAX: { min: 0.85, max: 1.00, key: 'max' },    // 大/全屏: 85%-100%
    WIDE: { min: 0.70, max: 0.85, key: 'wide' },   // 宽屏: 70%-85%
    MEDIUM: { min: 0.50, max: 0.70, key: 'medium' }, // 中/分屏: 50%-70% (半屏通常在 50% 左右)
    SMALL: { min: 0.00, max: 0.50, key: 'small' }  // 小/挂件: ≤50%
  }

  // 默认各档位 widthRatio
  const DEFAULT_WIDTH_RATIOS = {
    max: 0.20,    // MAX 档位默认 20%
    wide: 0.22,   // WIDE 档位默认 22%
    medium: 0.25, // MEDIUM 档位默认 25%
    small: 0.30   // SMALL 档位默认 30%（小窗口浮窗相对更大）
  }

  // 获取当前档位
  // 使用浏览器物理窗口和屏幕大小比例，排除页面缩放（Zoom）和系统缩放（DPI）的影响
  function getCurrentTier() {
    // window.outerWidth: 浏览器外框宽度（逻辑像素，不受页面缩放影响）
    // screen.availWidth: 屏幕可用宽度（逻辑像素，不受页面缩放影响）
    // 这种计算方式可以完美避开 devicePixelRatio 带来的缩放干扰
    const windowWidth = globalThis.window?.outerWidth || globalThis.window?.innerWidth || 1024
    const screenWidth = globalThis.screen?.availWidth || globalThis.screen?.width || windowWidth

    const ratio = windowWidth / screenWidth
    if (ratio >= VIEWPORT_TIERS.MAX.min) return 'max'
    if (ratio >= VIEWPORT_TIERS.WIDE.min) return 'wide'
    if (ratio >= VIEWPORT_TIERS.MEDIUM.min) return 'medium'
    return 'small'
  }

  // 获取当前档位的 widthRatio
  function getCurrentWidthRatio(widthRatios, currentTier, fallbackRatio) {
    if (widthRatios && Number.isFinite(widthRatios[currentTier])) {
      return widthRatios[currentTier]
    }
    return fallbackRatio
  }

  // 从版本 4/5 迁移到版本 6
  function migrateToV6(value, viewport) {
    const singleRatio = value.widthRatio || (value.width / value.viewportWidth) || 0.20
    const currentTier = getCurrentTier()
    
    // 如果 value 本身就是版本 5，那么可能已经有 widthRatios 了
    const newWidthRatios = value.widthRatios || {
      max: singleRatio,
      wide: singleRatio,
      medium: singleRatio,
      small: singleRatio
    }

    return {
      version: 6,
      left: value.left,
      top: value.top,
      width: value.width,
      viewportWidth: value.viewportWidth,
      viewportHeight: value.viewportHeight,
      right: value.right,
      bottom: value.bottom,
      pageZoom: value.pageZoom,
      widthRatios: newWidthRatios,
      activeTier: currentTier
    }
  }
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
  
  function getPageZoom() {
    return globalThis.devicePixelRatio || 1
  }

  function getEffectiveMinWidth() {
    return Math.floor(ABSOLUTE_MIN_WIDTH / getPageZoom())
  }
  const MAX_VIEWPORT_RATIO = 0.50
  const PLAYER_Z_INDEX = 999999
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
    let manuallyClosed = false

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
        
        if (!playerOutOfView) {
          manuallyClosed = false
        }

        if (manuallyClosed) {
          return false
        }

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
        manuallyClosed = true
        return false
      }
    }
  }

  function getSavedYouTubeGeometry() {
    try {
      const data = globalThis.localStorage.getItem("floatingVideoState:youtube")
      if (data) {
        const value = JSON.parse(data)
        // 支持版本 3, 4, 5, 6
        if ([3, 4, 5, 6].includes(value?.version) && Number.isFinite(value.left) && Number.isFinite(value.top) && Number.isFinite(value.width)) {
          return {
            left: value.left,
            top: value.top,
            width: value.width,
            widthRatio: value.widthRatio,
            widthRatios: value.widthRatios,
            pageZoom: value.pageZoom
          }
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
        const isNewActivation = !player.classList.contains(BILIBILI_CLASS)

        if (isNewActivation) {
          setAncestorsOverflowVisible(player)
        }

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
        clearAncestorsOverflowVisible()
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

      return Math.max(getEffectiveMinWidth(), maxWidth)
    }

    function getMinWidthForViewport(ratio, viewport = getViewportMetrics()) {
      return Math.min(getEffectiveMinWidth(), getMaxWidthForViewport(ratio, viewport))
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

      const result = {
        left: clamp(Math.round(geometry.left), MARGIN, maxLeft),
        top: clamp(Math.round(geometry.top), MARGIN, maxTop),
        width,
        height
      }

      if (Number.isFinite(Number(geometry.widthRatio))) {
        result.widthRatio = Number(geometry.widthRatio)
      }

      // 传递 widthRatios 供后续使用
      if (geometry.widthRatios) {
        result.widthRatios = geometry.widthRatios
      }

      if (Number.isFinite(Number(geometry.pageZoom))) {
        result.pageZoom = Number(geometry.pageZoom)
      } else {
        result.pageZoom = getPageZoom()
      }

      return result
    }

    function createResponsiveGeometrySnapshot(player, geometry, viewport = getViewportMetrics(), updateRatio = true) {
      const nextGeometry = clampGeometry(player, geometry, viewport)
      const currentTier = getCurrentTier()

      // 继承或初始化各档位的 widthRatios
      const existingRatios = geometry.widthRatios || {}
      const currentRatio = nextGeometry.width / viewport.width

      const widthRatios = {
        max: Number.isFinite(existingRatios.max) ? existingRatios.max : currentRatio,
        wide: Number.isFinite(existingRatios.wide) ? existingRatios.wide : currentRatio,
        medium: Number.isFinite(existingRatios.medium) ? existingRatios.medium : currentRatio,
        small: Number.isFinite(existingRatios.small) ? existingRatios.small : currentRatio
      }

      // 仅在明确需要更新比例（如用户拖动或缩放浮窗）时，才更新当前档位的 widthRatio
      if (updateRatio) {
        widthRatios[currentTier] = currentRatio
      }

      return {
        version: STORAGE_SCHEMA_VERSION,
        left: nextGeometry.left,
        top: nextGeometry.top,
        width: nextGeometry.width,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        right: Math.max(MARGIN, viewport.width - nextGeometry.left - nextGeometry.width),
        bottom: Math.max(MARGIN, viewport.height - nextGeometry.top - nextGeometry.height),
        widthRatios,
        activeTier: currentTier,
        pageZoom: Number.isFinite(Number(geometry.pageZoom)) ? Number(geometry.pageZoom) : getPageZoom()
      }
    }

      function adaptGeometryToViewport(player, value, viewport = getViewportMetrics()) {
        const ratio = getAspectRatio(player)
        const left = Number(value.left)
        const top = Number(value.top)
        const width = Number(value.width)
        const sourceViewportWidth = Number(value.viewportWidth)
        const sourceViewportHeight = Number(value.viewportHeight)

        const oldZoom = Number.isFinite(Number(value.pageZoom)) ? Number(value.pageZoom) : getPageZoom()
        const currentZoom = getPageZoom()
        const zoomRatio = oldZoom / currentZoom

        let right = Number.isFinite(Number(value.right))
          ? Number(value.right)
          : sourceViewportWidth - left - width
        let bottom = Number.isFinite(Number(value.bottom))
          ? Number(value.bottom)
          : sourceViewportHeight - top - Math.round(width / ratio)

        // Scale gaps to maintain absolute physical distance during zoom
        right *= zoomRatio
        bottom *= zoomRatio

        // 获取当前档位
        const currentTier = getCurrentTier()

        // 获取当前档位的 widthRatio（支持多档位或单档位）
        const fallbackRatio = sourceViewportWidth > 0 ? width / sourceViewportWidth : 0.20
        const currentWidthRatio = getCurrentWidthRatio(value.widthRatios, currentTier, fallbackRatio)

        // 使用当前档位的 widthRatio 计算宽度
        const nextWidth = viewport.width * currentWidthRatio

        const clampedWidth = clamp(
          Math.round(nextWidth),
          getMinWidthForViewport(ratio, viewport),
          getMaxWidthForViewport(ratio, viewport)
        )
        const clampedHeight = Math.round(clampedWidth / ratio)
        // 计算原本右边缘距离的百分比，如果距右边更近，保持右边距离的绝对值不变（仅缩放比例）
        const isCloserToRight = left > (sourceViewportWidth / 2 - width / 2)
        
        let nextLeft
        if (isCloserToRight) {
          nextLeft = viewport.width - right - clampedWidth
        } else {
          nextLeft = left * zoomRatio
        }

        // Check if the player was closer to the top or bottom in the original viewport
        const isCloserToBottom = top > (sourceViewportHeight / 2 - Math.round(width / ratio) / 2)
        
        let nextTop
        if (isCloserToBottom) {
          nextTop = viewport.height - bottom - clampedHeight
        } else {
          nextTop = top * zoomRatio
        }

        const maxLeft = Math.max(MARGIN, viewport.width - MARGIN - clampedWidth)
        const maxTop = Math.max(MARGIN, viewport.height - MARGIN - clampedHeight)

        // 保持 widthRatios 供后续使用
        const widthRatios = value.widthRatios || {
          max: currentWidthRatio,
          wide: currentWidthRatio,
          medium: currentWidthRatio,
          small: currentWidthRatio
        }

        return clampGeometry(player, {
          left: nextLeft,
          top: nextTop,
          width: clampedWidth,
          widthRatio: currentWidthRatio,
          widthRatios,
          pageZoom: currentZoom
        }, viewport)
      }

  function sanitizeSavedGeometry(player, value, viewport = getViewportMetrics()) {
    if (!value || typeof value !== "object") {
      return null
    }

    // 支持版本 3, 4, 5, 6
    if (![2, 3, 4, 5, 6].includes(value.version)) {
      return null
    }

    const left = Number(value.left)
    const top = Number(value.top)
    const width = Number(value.width)

    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width)) {
      return null
    }

    // 版本 5：直接使用多档位逻辑
    if (value.version === 6) {
      const viewportWidth = Number(value.viewportWidth)
      const viewportHeight = Number(value.viewportHeight)

      if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight)) {
        return adaptGeometryToViewport(player, value, viewport)
      }
    }

    // 版本 3/4/5：迁移到版本 6
    if (value.version === 3 || value.version === 4 || value.version === 5) {
      const migratedValue = migrateToV6(value, viewport)
      return adaptGeometryToViewport(player, migratedValue, viewport)
    }

    // 版本 2 及以下：使用旧逻辑
    const widthRatio = Number(value.widthRatio)
    const pageZoom = Number(value.pageZoom)
    const finalWidthRatio = Number.isFinite(widthRatio) ? widthRatio : (width / viewport.width)
    const finalPageZoom = Number.isFinite(pageZoom) ? pageZoom : getPageZoom()
    return clampGeometry(player, { left, top, width, widthRatio: finalWidthRatio, pageZoom: finalPageZoom }, viewport)
  }

  // 防抖函数
  function debounce(fn, delay) {
    let timer = null
    return function (...args) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        fn.apply(this, args)
        timer = null
      }, delay)
    }
  }

  // 立即执行的持久化（用于需要立即保存的场景）
  function persistGeometryImmediate(geometry) {
    if (!currentPlayer) {
      return
    }
    savedGeometry = createResponsiveGeometrySnapshot(currentPlayer, geometry)
    storage.set(savedGeometry)
  }

  // 防抖持久化（用于频繁触发的场景，如拖拽）
  const persistGeometry = debounce(persistGeometryImmediate, 500)

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

    return clampGeometry(currentPlayer, {
      left,
      top,
      width,
      widthRatio: width / getViewportMetrics().width,
      widthRatios: startGeometry.widthRatios,
      pageZoom: getPageZoom()
    })
  }

    function computeMoveGeometry(event) {
      const { startX, startY, startGeometry } = dragging

      return clampGeometry(currentPlayer, {
        left: startGeometry.left + (event.clientX - startX),
        top: startGeometry.top + (event.clientY - startY),
        width: startGeometry.width,
        widthRatio: startGeometry.widthRatio,
        widthRatios: startGeometry.widthRatios,
        pageZoom: startGeometry.pageZoom
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
    
    suppressPlayerClickUntil = performance.now() + 200
    
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
        z-index: ${PLAYER_Z_INDEX + 1};
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
        min-width: 0 !important;
        min-height: 0 !important;
      }

      .bpx-player-container.${BILIBILI_CLASS} {
        z-index: ${PLAYER_Z_INDEX + 1} !important;
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
          min-width: 0 !important;
          min-height: 0 !important;
        }

#movie_player.${YOUTUBE_CLASS} {
        position: fixed !important;
        z-index: ${PLAYER_Z_INDEX + 1} !important;
        top: 0 !important;
        left: 0 !important;
        background: #000 !important;
        box-shadow: rgba(0, 0, 0, .4) 0 2px 8px !important;
        will-change: transform, width, height !important;
      }

        #movie_player.${YOUTUBE_CLASS} .html5-video-container {
          width: 100% !important;
          height: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
        }

        #movie_player.${YOUTUBE_CLASS} video {
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          max-height: none !important;
          min-width: 0 !important;
          min-height: 0 !important;
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
      persistGeometryImmediate(nextGeometry)
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
            createResponsiveGeometrySnapshot(player, currentGeometry, lastViewport, false),
            viewport
          )
        : currentGeometry

    const geometry =
      (currentPlayer === player && responsiveCurrentGeometry) ||
      sanitizeSavedGeometry(player, savedGeometry, viewport) ||
      site.getDefaultGeometry(player)

    applyGeometry(player, geometry)

    if (savedGeometry && viewportChanged) {
      savedGeometry = createResponsiveGeometrySnapshot(player, currentGeometry, viewport, false)
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

    // 页面关闭前立即保存数据（防止防抖延迟导致数据丢失）
    globalThis.addEventListener("beforeunload", () => {
      if (currentPlayer && currentGeometry) {
        persistGeometryImmediate(currentGeometry)
      }
    })
  }

  ensureStyles()
  ensureOverlay()
  installObservers()
  storage.get((value) => {
    // 支持版本 2, 3, 4, 5, 6
    if ([2, 3, 4, 5, 6].includes(value?.version)) {
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