// src/contentScript/brushTool.ts

let isDrawing = false;
let brushCanvas: HTMLCanvasElement | null = null;
let brushCtx: CanvasRenderingContext2D | null = null;
let brushPath: Array<{ x: number; y: number }> = [];

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
  brushCanvas.style.zIndex = '2147483647'; // max z-index
  brushCanvas.style.pointerEvents = 'none';
  brushCanvas.style.background = 'transparent';
  brushCanvas.setAttribute('data-gemma-brush', 'true');
  document.body.appendChild(brushCanvas);
  brushCtx = brushCanvas.getContext('2d');
  if (brushCtx) {
    brushCtx.setTransform(1, 0, 0, 1, 0, 0); // reset any previous transform
    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    brushCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    brushCtx.strokeStyle = '#4f8cff';
    brushCtx.lineWidth = 3;
    brushCtx.lineCap = 'round';
    brushCtx.lineJoin = 'round';
  }
}

function onMouseDown(e: MouseEvent, showContextMenu: (x: number, y: number) => void) {
  // If the click is on our context menu, do nothing.
  if ((e.target as HTMLElement).closest('[data-gemma-context-menu]')) {
    return;
  }

  if (e.button !== 0) return;
  // Only allow drawing if brush tool is active (canvas exists)
  if (!brushCanvas) {
    createBrushCanvas();
  }
  // Only start drawing if the event target is NOT a UI element from the page or sidebar
  if ((e.target as HTMLElement)?.closest('[data-gemma-brush]')) {
    // Prevent drawing on our own overlay
    return;
  }
  // removeContextMenu(); // This should be handled by the context menu module
  // Enable pointer events so canvas can receive mouse events
  if (brushCanvas) brushCanvas.style.pointerEvents = 'auto';
  isDrawing = true;
  brushPath = [{ x: e.clientX, y: e.clientY }];
  if (brushCtx) {
    brushCtx.beginPath();
    brushCtx.moveTo(e.clientX, e.clientY);
  }
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', (event) => onMouseUp(event, showContextMenu));
}

function onMouseMove(e: MouseEvent) {
  if (!isDrawing || !brushCtx) return;
  brushPath.push({ x: e.clientX, y: e.clientY });
  brushCtx.lineTo(e.clientX, e.clientY);
  brushCtx.stroke();
}

function onMouseUp(e: MouseEvent, showContextMenu: (x: number, y: number) => void) {
  if (!isDrawing) return;
  isDrawing = false;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', (event) => onMouseUp(event, showContextMenu));
  // Disable pointer events so canvas doesn't block page after drawing
  if (brushCanvas) brushCanvas.style.pointerEvents = 'none';
  // Show context menu at last mouse position
  showContextMenu(e.clientX, e.clientY);
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

export function captureAndSendBrush(prompt?: string) {
  if (!brushCanvas || brushPath.length < 2) return;
  // Get bounding box of the path
  const bbox = getBrushBoundingBox(brushPath);
  chrome.runtime.sendMessage({
    type: 'analyzeArea',
    area: { ...bbox, devicePixelRatio: window.devicePixelRatio },
    prompt: prompt || undefined,
  });
}

export function clearBrushSelection() {
  removeBrushCanvas();
}

export function activateBrushTool(showContextMenu: (x: number, y: number) => void) {
  window.addEventListener('mousedown', (event) => onMouseDown(event, showContextMenu), { capture: true });
  console.debug('[Gemma] Brush tool activated');
}

export function deactivateBrushTool() {
  window.removeEventListener('mousedown', (event) => onMouseDown(event, () => {}), { capture: true }); // Pass empty function for showContextMenu
  removeBrushCanvas();
  console.debug('[Gemma] Brush tool deactivated');
}

export function cleanupBrushTool() {
  removeBrushCanvas();
  window.removeEventListener('mousedown', (event) => onMouseDown(event, () => {}), { capture: true });
}
