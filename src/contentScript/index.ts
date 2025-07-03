// contentScript.ts
// Handles drawing selection and context menu for area analysis

import { activateBrushTool, deactivateBrushTool, captureAndSendBrush, cleanupBrushTool, clearBrushSelection } from './brushTool';
import { showContextMenu, removeContextMenu } from './contextMenu';

let brushActive = false;

// Listen for activation from extension (so it doesn't always run)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'activateSelection') {
    if (!brushActive) {
      activateBrushTool((x, y) => showContextMenu(
        x, y,
        captureAndSendBrush,
        () => {
          clearBrushSelection();
          removeContextMenu();
          brushActive = false; // Deactivate brush after clearing
          chrome.runtime.sendMessage({ type: 'deactivateBrushUI' }); // Inform UI
        },
        (prompt: string) => {
          captureAndSendBrush(prompt);
          removeContextMenu();
        }
      ));
      brushActive = true;
    }
    sendResponse?.({ ok: true });
  } else if (msg.type === 'deactivateSelection') {
    if (brushActive) {
      deactivateBrushTool();
      removeContextMenu();
      brushActive = false;
    }
    sendResponse?.({ ok: true });
  }
});

// Debug: always log when script loads
console.debug('[Gemma] contentScript loaded');

// Clean up on navigation
window.addEventListener('beforeunload', () => {
  cleanupBrushTool();
  removeContextMenu();
});