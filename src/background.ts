chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "captureScreen") {
    const tab = sender.tab;
    if (tab && tab.windowId) {
      chrome.tabs.captureVisibleTab(
        tab.windowId,
        { format: "png" },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            // Optionally send an error response back to the side panel
            chrome.runtime.sendMessage({
              type: "captureResponse",
              error: chrome.runtime.lastError.message,
            });
          } else {
            chrome.runtime.sendMessage({ type: "captureResponse", dataUrl });
          }
        }
      );
    } else {
      // Fallback for when sender.tab is not available, e.g. from the extension's own pages
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.captureVisibleTab(
            tabs[0].windowId,
            { format: "png" },
            (dataUrl) => {
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                chrome.runtime.sendMessage({
                  type: "captureResponse",
                  error: chrome.runtime.lastError.message,
                });
              } else {
                chrome.runtime.sendMessage({
                  type: "captureResponse",
                  dataUrl,
                });
              }
            }
          );
        }
      });
    }
    return true; // Indicates that the response is sent asynchronously
  }
});
