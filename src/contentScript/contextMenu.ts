// src/contentScript/contextMenu.ts

let contextMenu: HTMLDivElement | null = null;

export function removeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

export function showContextMenu(
  x: number,
  y: number,
  onAnalyzeClick: () => void,
  onClearSelection: () => void,
  onCustomPrompt: (prompt: string) => void
) {
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
  contextMenu.style.zIndex = '21474483647'; // Ensure it's above everything
  contextMenu.style.fontFamily = 'sans-serif';
  contextMenu.style.color = '#e0e0e0';
  contextMenu.style.display = 'flex';
  contextMenu.style.flexDirection = 'column';
  contextMenu.style.gap = '8px';
  contextMenu.setAttribute('data-gemma-context-menu', 'true');

  const createButton = (text: string, onClick: () => void) => {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: #3a3a3a;
      color: #e0e0e0;
      border: none;
      padding: 6px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      text-align: left;
      transition: background 0.2s ease;
    `;
    button.onmouseover = () => button.style.background = '#4a4a4a';
    button.onmouseout = () => button.style.background = '#3a3a3a';
    button.onclick = onClick;
    return button;
  };

  // Analyze section button
  const analyzeButton = createButton('Analyze selection', () => {
    onAnalyzeClick();
    removeContextMenu();
  });
  contextMenu.appendChild(analyzeButton);

  // Clear selection button
  const clearButton = createButton('Clear selection', () => {
    onClearSelection();
    removeContextMenu();
  });
  contextMenu.appendChild(clearButton);

  // Custom prompt button and input
  const customPromptContainer = document.createElement('div');
  customPromptContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  const customPromptButton = createButton('Custom prompt...', () => {
    customPromptButton.style.display = 'none';
    customPromptContainer.style.display = 'flex';
    inputField.focus();
  });
  contextMenu.appendChild(customPromptButton);

  const inputField = document.createElement('input');
  inputField.type = 'text';
  inputField.placeholder = 'Enter your prompt...';
  inputField.style.cssText = `
    background: #3a3a3a;
    color: #e0e0e0;
    border: 1px solid #555555;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 14px;
    outline: none;
  `;
  inputField.onfocus = () => inputField.style.borderColor = '#4f8cff';
  inputField.onblur = () => inputField.style.borderColor = '#555555';
  customPromptContainer.appendChild(inputField);

  const sendPromptButton = createButton('Send', () => {
    if (inputField.value.trim()) {
      onCustomPrompt(inputField.value.trim());
      removeContextMenu(); // Close menu after sending custom prompt
    }
  });
  customPromptContainer.appendChild(sendPromptButton);
  customPromptContainer.style.display = 'none'; // Hidden by default
  contextMenu.appendChild(customPromptContainer);

  document.body.appendChild(contextMenu);
}
