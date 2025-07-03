// src/background/offscreenManager.ts

let creating: Promise<void> | null;

export async function createOffscreenDocument() {
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

export async function closeOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.closeDocument();
  }
}
