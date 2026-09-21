(() => {
  // Bilibili 网页全屏快捷键
  //
  // 本文件是单独一个 content_scripts entry 的入口，因此必须自包含：
  // 存储键、默认键、normalizeKey 全部收在这个 IIFE 内，不依赖任何其它脚本的顶层作用域。
  // 原因见 AGENTS.md「踩坑规则」：同一扩展在同一 frame 共享一个 isolated world，
  // 若本文件与其它脚本各自声明顶层 const，会 `Identifier '...' has already been declared`，
  // 导致后加载的脚本整体不执行。
  //
  // 行为与归档的 bilibili_Tmode 保持一致，仅改动：存储键名 + 作用域收拢。

  // 同一 frame 内被注入两次时只注册一次。两次注册会让按钮被点击两次，等于没切换。
  if (globalThis.__biliWebFullscreenHotkeyLoaded) {
    return;
  }
  globalThis.__biliWebFullscreenHotkeyLoaded = true;

  const HOTKEY_STORAGE_KEY = "shortcut:bilibiliWebFullscreen";
  const DEFAULT_HOTKEY = "t";
  const WEB_FULLSCREEN_TEXT = "网页全屏";

  const PLAYER_ROOT_SELECTORS = [
    ".bpx-player-container",
    ".bilibili-player",
    "#bilibili-player",
    "#player_module",
    ".squirtle-video-wrap"
  ];

  const BUTTON_SELECTORS = [
    ".bpx-player-ctrl-web",
    ".bpx-player-ctrl-btn[data-screen='web']",
    ".bpx-player-ctrl-btn[aria-label*='网页全屏']",
    ".bpx-player-ctrl-btn[title*='网页全屏']",
    ".bilibili-player-video-web-fullscreen",
    ".squirtle-pagefullscreen",
    ".squirtle-video-pagefullscreen"
  ];

  const BUTTON_LIKE_SELECTOR = [
    "button",
    "[role='button']",
    ".bpx-player-ctrl-btn",
    ".bilibili-player-video-btn",
    ".squirtle-controller-button"
  ].join(", ");

  let shortcutKey = DEFAULT_HOTKEY;

  // 与 options.js 中的同名函数必须保持一致（两处刻意重复，见该文件的注释）
  function normalizeKey(value) {
    if (typeof value !== "string") {
      return DEFAULT_HOTKEY;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue && value !== " ") {
      return DEFAULT_HOTKEY;
    }

    if (value === " " || trimmedValue.toLowerCase() === "spacebar") {
      return "space";
    }

    return trimmedValue.toLowerCase();
  }

  function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    if (target.isContentEditable || target.closest("[contenteditable='true']")) {
      return true;
    }

    return Boolean(target.closest("input, textarea, select"));
  }

  function getPlayerRoots() {
    const roots = [];

    for (const selector of PLAYER_ROOT_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        roots.push(element);
      }
    }

    roots.push(document);
    return roots;
  }

  function getButtonElement(element) {
    return element.closest(BUTTON_LIKE_SELECTOR) || element;
  }

  function hasWebFullscreenLabel(element) {
    const textCandidates = [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-tooltip"),
      element.textContent
    ];

    return textCandidates.some(
      (value) => typeof value === "string" && value.includes(WEB_FULLSCREEN_TEXT)
    );
  }

  function isInsidePlayer(element) {
    return PLAYER_ROOT_SELECTORS.some((selector) => element.closest(selector));
  }

  function findWebFullscreenButton() {
    for (const root of getPlayerRoots()) {
      for (const selector of BUTTON_SELECTORS) {
        const element = root.querySelector(selector);

        if (element) {
          return getButtonElement(element);
        }
      }
    }

    for (const element of document.querySelectorAll(BUTTON_LIKE_SELECTOR)) {
      if (isInsidePlayer(element) && hasWebFullscreenLabel(element)) {
        return getButtonElement(element);
      }
    }

    return null;
  }

  function loadShortcut() {
    chrome.storage.sync.get({ [HOTKEY_STORAGE_KEY]: DEFAULT_HOTKEY }, (result) => {
      shortcutKey = normalizeKey(result[HOTKEY_STORAGE_KEY]);
    });
  }

  // 设置页保存后无需刷新页面即可生效
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[HOTKEY_STORAGE_KEY]) {
      return;
    }

    shortcutKey = normalizeKey(changes[HOTKEY_STORAGE_KEY].newValue);
  });

  document.addEventListener(
    "keydown",
    (event) => {
      // 1) 输入法组合中 / 长按重复按键，不处理
      if (event.isComposing || event.repeat) {
        return;
      }

      // 2) 带修饰键，不处理
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return;
      }

      // 3) 焦点在搜索框、评论框等可编辑区域，不处理
      if (isEditableTarget(event.target)) {
        return;
      }

      // 4) 不是目标按键，不处理
      if (normalizeKey(event.key) !== shortcutKey) {
        return;
      }

      const webFullscreenButton = findWebFullscreenButton();

      // 顺序很关键：找不到按钮必须在 preventDefault 之前返回，否则页面会被误伤
      if (!webFullscreenButton) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      webFullscreenButton.click();
    },
    true
  );

  loadShortcut();
})();
