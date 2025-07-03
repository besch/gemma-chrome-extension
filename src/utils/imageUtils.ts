// src/utils/imageUtils.ts

// Helper to crop a base64 PNG dataUrl to a given rectangle
export async function cropImage(dataUrl: string, area: { left: number; top: number; width: number; height: number; devicePixelRatio: number }) {
  return new Promise<string>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = area.width * area.devicePixelRatio;
      canvas.height = area.height * area.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');
      ctx.drawImage(
        img,
        area.left * area.devicePixelRatio,
        area.top * area.devicePixelRatio,
        area.width * area.devicePixelRatio,
        area.height * area.devicePixelRatio,
        0, 0,
        area.width * area.devicePixelRatio,
        area.height * area.devicePixelRatio
      );
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
