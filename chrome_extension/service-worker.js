/*
 * Service worker này là BẮT BUỘC cho Side Bar.
 * Nhiệm vụ duy nhất của nó là lắng nghe khi người dùng
 * nhấn vào icon của extension (action) và mở Side Bar.
 */
chrome.action.onClicked.addListener((tab) => {
  // Mở side panel trong cửa sổ (window) hiện tại
  chrome.sidePanel.open({ windowId: tab.windowId });
});
