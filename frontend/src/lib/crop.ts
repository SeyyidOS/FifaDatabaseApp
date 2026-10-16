/**
 * Cropping a photo to a square: the image is shown in a square frame of `frame` px, covering it, then
 * zoomed and dragged. A view is where the image's top-left corner sits in the frame and how many screen
 * pixels one image pixel takes.
 */
export interface CropView {
  x: number;
  y: number;
  scale: number;
}

/** The scale at which the image just covers the frame (zoom 1). */
export const coverScale = (w: number, h: number, frame: number) => Math.max(frame / w, frame / h);

/** Moved back so the image still covers the whole frame. */
export function clampView(view: CropView, w: number, h: number, frame: number): CropView {
  const x = Math.min(0, Math.max(frame - w * view.scale, view.x));
  const y = Math.min(0, Math.max(frame - h * view.scale, view.y));
  return { x, y, scale: view.scale };
}

/** Covering the frame, centred. */
export function initialView(w: number, h: number, frame: number): CropView {
  const scale = coverScale(w, h, frame);
  return { x: (frame - w * scale) / 2, y: (frame - h * scale) / 2, scale };
}

/** At `zoom` (1 = covering), around the frame's centre. */
export function zoomView(view: CropView, zoom: number, w: number, h: number, frame: number): CropView {
  const scale = coverScale(w, h, frame) * zoom;
  const c = frame / 2;
  const k = scale / view.scale;
  return clampView({ x: c - (c - view.x) * k, y: c - (c - view.y) * k, scale }, w, h, frame);
}

/** The square of the image, in its own pixels, that the frame shows. */
export function sourceSquare(view: CropView, frame: number) {
  return { sx: -view.x / view.scale, sy: -view.y / view.scale, size: frame / view.scale };
}
