// 扩展设置页：本页只负责「Bilibili 网页全屏快捷键」。
//
// 本页与 hotkey.js 共用同一个存储键，但两者无法互相 import
// （content script 与扩展页不共享作用域，本仓库也不引入构建步骤），
// 所以下面这组常量是【刻意的重复声明】。
// 改动 HOTKEY_STORAGE_KEY / DEFAULT_HOTKEY 时，必须同步修改 hotkey.js 中的同名常量。

const HOTKEY_STORAGE_KEY = "shortcut:bilibiliWebFullscreen";
const DEFAULT_HOTKEY = "t";

const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"]);

const shortcutInput = document.getElementById("shortcutInput");
const recordButton = document.getElementById("recordButton");
const resetButton = document.getElementById("resetButton");
const hint = document.getElementById("hint");
const status = document.getElementById("status");

let currentShortcutKey = DEFAULT_HOTKEY;
let isRecording = false;

// 与 hotkey.js 中的同名函数必须保持一致
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

function formatKey(value) {
  const normalizedValue = normalizeKey(value);

  if (normalizedValue === "space") {
    return "Space";
  }

  if (normalizedValue.length === 1) {
    return normalizedValue.toUpperCase();
  }

  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
}

function setStatus(message, tone) {
  status.textContent = message;
  status.dataset.tone = tone;
}

function renderShortcut() {
  shortcutInput.value = formatKey(currentShortcutKey);
}

function stopRecording() {
  isRecording = false;
  recordButton.classList.remove("recording");
  recordButton.textContent = "录制新按键";
  hint.textContent = "点击“录制新按键”后，按下一个按键即可保存。";
}

function startRecording() {
  isRecording = true;
  recordButton.classList.add("recording");
  recordButton.textContent = "等待按键...";
  hint.textContent = "请按下一个非修饰键，按 Esc 取消。";
  setStatus("等待新的快捷键...", "info");
}

function saveShortcut(nextKey) {
  chrome.storage.sync.set({ [HOTKEY_STORAGE_KEY]: nextKey }, () => {
    if (chrome.runtime.lastError) {
      setStatus(`保存失败：${chrome.runtime.lastError.message}`, "error");
      return;
    }

    currentShortcutKey = normalizeKey(nextKey);
    renderShortcut();
    setStatus(`已保存为 ${formatKey(currentShortcutKey)}`, "success");
  });
}

function loadShortcut() {
  chrome.storage.sync.get({ [HOTKEY_STORAGE_KEY]: DEFAULT_HOTKEY }, (result) => {
    if (chrome.runtime.lastError) {
      renderShortcut();
      setStatus(`加载失败：${chrome.runtime.lastError.message}`, "error");
      return;
    }

    currentShortcutKey = normalizeKey(result[HOTKEY_STORAGE_KEY]);
    renderShortcut();
    setStatus(`当前快捷键：${formatKey(currentShortcutKey)}`, "info");
  });
}

recordButton.addEventListener("click", () => {
  if (isRecording) {
    stopRecording();
    setStatus("已取消录制。", "info");
    return;
  }

  startRecording();
});

resetButton.addEventListener("click", () => {
  stopRecording();
  saveShortcut(DEFAULT_HOTKEY);
});

document.addEventListener(
  "keydown",
  (event) => {
    if (!isRecording) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.key === "Escape") {
      stopRecording();
      setStatus("已取消录制。", "info");
      return;
    }

    if (MODIFIER_KEYS.has(event.key)) {
      setStatus("请按下一个非修饰键。", "error");
      return;
    }

    stopRecording();
    saveShortcut(normalizeKey(event.key));
  },
  true
);

loadShortcut();
