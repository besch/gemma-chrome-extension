chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "getText") {
    const text = document.body.innerText;
    sendResponse({ text });
  }
});
