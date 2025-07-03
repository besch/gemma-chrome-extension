// src/contentScript/contextMenu.ts

let contextMenu: HTMLDivElement | null = null;

export function removeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

export function showContextMenu(x: number, y: number, onAnalyzeClick: () => void) {
  removeContextMenu();
  contextMenu = document.createElement('div');
  contextMenu.style.position = 'fixed';
  contextMenu.style.left = `${x + 8}px`;
  contextMenu.style.top = `${y + 8}px`;
  contextMenu.style.background = '#2a2a2a';
  contextMenu.style.border = '1px solid #444444';
  contextMenu.style.borderRadius = '6px';
  contextMenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  contextMenu.style.padding = '8px 12px';
  contextMenu.style.zIndex = '2147483647';
  contextMenu.style.fontFamily = 'sans-serif';
  contextMenu.style.cursor = 'pointer';
  contextMenu.style.color = '#e0e0e0'; // Set text color
  contextMenu.setAttribute('data-gemma-context-menu', 'true'); // Add identifier
  contextMenu.textContent = 'Analyze section';
  contextMenu.addEventListener('click', () => {
    onAnalyzeClick();
    removeContextMenu();
  });
  document.body.appendChild(contextMenu);
}
