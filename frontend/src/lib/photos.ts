/** Most photos a match holds (backend/photos.py). */
export const MAX_PHOTOS = 10;

/** Longest side sent to the server: the stats screen's small print stays readable. */
const MAX_EDGE = 2560;

/**
 * A phone photo shrunk to MAX_EDGE as a JPEG before it is sent, a few hundred KB instead of several MB,
 * and turned upright. An image the browser can't draw (HEIC outside Safari) is sent as it is, and the
 * server says whether it can read it.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ?? file;
}
