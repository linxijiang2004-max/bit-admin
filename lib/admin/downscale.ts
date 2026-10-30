// Browser-only: shrink an image before it's uploaded. Long edge capped at
// MAX_EDGE (never upscaled), re-encoded as JPEG at JPEG_QUALITY. Animated
// GIFs keep only their first frame; transparency is flattened onto white.

export const MAX_EDGE = 1024;
export const JPEG_QUALITY = 0.8;
// The source never leaves the browser; this only bounds decode memory.
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export type Downscaled = {
  blob: Blob;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  sourceBytes: number;
};

export async function downscaleImage(file: File): Promise<Downscaled> {
  // imageOrientation applies EXIF rotation, so phone photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas is unavailable in this browser");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("couldn't encode the image as JPEG");
    return {
      blob,
      width,
      height,
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
      sourceBytes: file.size,
    };
  } finally {
    bitmap.close();
  }
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
