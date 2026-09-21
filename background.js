// 工具栏图标点击 → 打开扩展设置页。
//
// manifest 的 action 未配置 default_popup，所以点击会触发 onClicked。
// 本文件移植自 bilibili_Tmode，行为不变。

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
