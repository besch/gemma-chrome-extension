// contentScript.ts
// Handles drawing selection and context menu for area analysis


// --- Brush Drawing Implementation ---
let isDrawing = false;
let brushCanvas: HTMLCanvasElement | null = null;
let brushCtx: CanvasRenderingContext2D | null = null;
let brushPath: Array<{ x: number; y: number }> = [];
let contextMenu: HTMLDivElement | null = null;

function removeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

function removeBrushCanvas() {
  if (brushCanvas) {
    brushCanvas.remove();
    brushCanvas = null;
    brushCtx = null;
    brushPath = [];
  }
}

function createBrushCanvas() {
  removeBrushCanvas();
  brushCanvas = document.createElement('canvas');
  brushCanvas.width = window.innerWidth * window.devicePixelRatio;
  brushCanvas.height = window.innerHeight * window.devicePixelRatio;
  brushCanvas.style.position = 'fixed';
  brushCanvas.style.left = '0';
  brushCanvas.style.top = '0';
  brushCanvas.style.width = '100vw';
  brushCanvas.style.height = '100vh';
  brushCanvas.style.zIndex = '999999';
  brushCanvas.style.pointerEvents = 'none';
  brushCanvas.style.background = 'transparent';
  document.body.appendChild(brushCanvas);
  brushCtx = brushCanvas.getContext('2d');
  if (brushCtx) {
    brushCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    brushCtx.strokeStyle = '#4f8cff';
    brushCtx.lineWidth = 3;
    brushCtx.lineCap = 'round';
    brushCtx.lineJoin = 'round';
  }
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  // Only allow drawing if pointerEvents are set to 'none' (so canvas doesn't block events)
  if (brushCanvas && brushCanvas.style.pointerEvents !== 'none') return;
  removeBrushCanvas();
  removeContextMenu();
  createBrushCanvas();
  // Enable pointer events so canvas can receive mouse events
  if (brushCanvas) brushCanvas.style.pointerEvents = 'auto';
  isDrawing = true;
  brushPath = [{ x: e.clientX, y: e.clientY }];
  if (brushCtx) {
    brushCtx.beginPath();
    brushCtx.moveTo(e.clientX, e.clientY);
  }
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  if (!isDrawing || !brushCtx) return;
  brushPath.push({ x: e.clientX, y: e.clientY });
  brushCtx.lineTo(e.clientX, e.clientY);
  brushCtx.stroke();
}

function onMouseUp(e: MouseEvent) {
  if (!isDrawing) return;
  isDrawing = false;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  // Disable pointer events so canvas doesn't block page after drawing
  if (brushCanvas) brushCanvas.style.pointerEvents = 'none';
  // Show context menu at last mouse position
  showContextMenu(e.clientX, e.clientY);
}

function showContextMenu(x: number, y: number) {
  removeContextMenu();
  contextMenu = document.createElement('div');
  contextMenu.style.position = 'fixed';
  contextMenu.style.left = `${x + 8}px`;
  contextMenu.style.top = `${y + 8}px`;
  contextMenu.style.background = '#fff';
  contextMenu.style.border = '1px solid #ccc';
  contextMenu.style.borderRadius = '6px';
  contextMenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  contextMenu.style.padding = '8px 12px';
  contextMenu.style.zIndex = '1000000';
  contextMenu.style.fontFamily = 'sans-serif';
  contextMenu.style.cursor = 'pointer';
  contextMenu.textContent = 'Analyze section';
  contextMenu.addEventListener('click', () => {
    captureAndSendBrush();
    removeContextMenu();
    removeBrushCanvas();
  });
  document.body.appendChild(contextMenu);
}

function getBrushBoundingBox(path: Array<{ x: number; y: number }>) {
  if (path.length === 0) return { left: 0, top: 0, width: 0, height: 0 };
  let minX = path[0].x, maxX = path[0].x, minY = path[0].y, maxY = path[0].y;
  for (const p of path) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function captureAndSendBrush() {
  if (!brushCanvas || brushPath.length < 2) return;
  // Get bounding box of the path
  const bbox = getBrushBoundingBox(brushPath);
  chrome.runtime.sendMessage({
    type: 'analyzeArea',
    area: { ...bbox, devicePixelRatio: window.devicePixelRatio }
  });
}

// Listen for activation from extension (so it doesn't always run)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'activateSelection') {
    window.addEventListener('mousedown', onMouseDown, { capture: true });
  } else if (msg.type === 'deactivateSelection') {
    window.removeEventListener('mousedown', onMouseDown, { capture: true });
    removeBrushCanvas();
    removeContextMenu();
  }
});

// Clean up on navigation
window.addEventListener('beforeunload', () => {
  removeBrushCanvas();
  removeContextMenu();
  window.removeEventListener('mousedown', onMouseDown, { capture: true });
});
