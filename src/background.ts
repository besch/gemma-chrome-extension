let creating: Promise<void> | null;

async function createOffscreenDocument() {
  // Check if we already have an offscreen document.
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  // create an offscreen document.
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Recording microphone audio',
    });
    await creating;
    creating = null;
  }
}

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'start-recording' || message.type === 'stop-recording') {
    await createOffscreenDocument();
    chrome.runtime.sendMessage({ ...message, target: 'offscreen' });
    return;
  }

  if (message.type === 'open-microphone-access') {
    chrome.windows.create({
      url: chrome.runtime.getURL('microphone-access.html'),
      type: 'popup',
      width: 400,
      height: 300,
    });
    return;
  }

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
    } else if (message.type === 'analyzeArea') {
      // 1. Capture the visible tab as an image
      chrome.tabs.captureVisibleTab(activeTab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          chrome.runtime.sendMessage({
            type: 'analyzeResult',
            error: chrome.runtime.lastError?.message || 'Failed to capture tab.'
          });
          return;
        }
        // 2. Crop the image to the selected area
        // Send to side panel for cropping and LLM analysis
        chrome.runtime.sendMessage({
          type: 'cropAndAnalyze',
          dataUrl,
          area: message.area
        });
      });
    }
  });

  return true; // Indicates that the response is sent asynchronously
});