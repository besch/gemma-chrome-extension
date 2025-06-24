chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Query for the active tab to ensure we have a target for the actions.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) {
      const error =
        "Could not find an active tab. Please focus a tab to interact with.";
      // Send an error response back for the appropriate action type.
      if (message.type === "captureScreen") {
        chrome.runtime.sendMessage({ type: "captureResponse", error });
      } else if (message.type === "getText") {
        chrome.runtime.sendMessage({ type: "textResponse", error });
      }
      return;
    }

    if (message.type === "captureScreen") {
      chrome.tabs.captureVisibleTab(
        activeTab.windowId,
        { format: "png" },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            chrome.runtime.sendMessage({
              type: "captureResponse",
              error: chrome.runtime.lastError.message,
            });
          } else {
            chrome.runtime.sendMessage({ type: "captureResponse", dataUrl });
          }
        }
      );
    } else if (message.type === "getText") {
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          func: () => document.body.innerText,
        },
        (injectionResults) => {
          if (chrome.runtime.lastError) {
            chrome.runtime.sendMessage({
              type: "textResponse",
              error: chrome.runtime.lastError.message,
            });
          } else if (
            injectionResults &&
            injectionResults[0] &&
            injectionResults[0].result
          ) {
            chrome.runtime.sendMessage({
              type: "textResponse",
              text: injectionResults[0].result,
            });
          } else {
            chrome.runtime.sendMessage({
              type: "textResponse",
              error: "Could not get text from the page.",
            });
          }
        }
      );
    }
  });

  return true; // Indicates that the response is sent asynchronously
});
