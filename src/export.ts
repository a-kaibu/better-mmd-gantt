export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, filename);
}

export function downloadPNG(
  svgString: string,
  filename: string,
  width: number,
  height: number,
  scale: number = 2
): Promise<void> {
  return renderToPNGBlob(svgString, width, height, scale).then((blob) => {
    downloadBlob(blob, filename);
  });
}

export function copyPNG(
  svgString: string,
  width: number,
  height: number,
  scale: number = 2
): Promise<void> {
  return renderToPNGBlob(svgString, width, height, scale).then((blob) => {
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error("ClipboardItem API not supported");
    }
    return navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
  });
}

function renderToPNGBlob(
  svgString: string,
  width: number,
  height: number,
  scale: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("PNG conversion failed"));
        }
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG loading failed"));
    };

    img.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
