import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";
import { useT } from "../../hooks/useI18n";
import { saveAccount, type AccountSession } from "../../lib/account";
import { accountApi, ApiError } from "../../lib/api";
import { clampView, initialView, sourceSquare, zoomView, type CropView } from "../../lib/crop";
import { defineMessages } from "../../lib/i18n";
import { Modal } from "../ui/Dialog";
import { Button } from "../ui/primitives";

const m = defineMessages({
  en: {
    title: "Your photo",
    hint: "Drag to frame your face; zoom with the slider.",
    zoom: "Zoom",
    cancel: "Cancel",
    save: "Save",
    saved: "Photo saved: your leagues see it on your player",
    unreadable: "This photo couldn't be opened. Try a JPEG or PNG.",
  },
  tr: {
    title: "Fotoğrafın",
    hint: "Yüzünü çerçeveye sürükle; kaydırıcıyla yakınlaştır.",
    zoom: "Yakınlaştır",
    cancel: "Vazgeç",
    save: "Kaydet",
    saved: "Fotoğraf kaydedildi: liglerin oyuncunda görecek",
    unreadable: "Bu fotoğraf açılamadı. JPEG ya da PNG dene.",
  },
});

/** The frame on screen, and the size of the square that is sent (backend/avatars.py keeps 512). */
const FRAME = 280;
const OUT = 512;

/** Picks the square of a chosen photo and saves it as the account's photo. */
export function PhotoCropper({ file, account, onClose }: { file: File | null; account: AccountSession; onClose: () => void }) {
  const t = useT(m);
  const queryClient = useQueryClient();
  const [image, setImage] = useState<{ bitmap: ImageBitmap; url: string } | null>(null);
  const [view, setView] = useState<CropView | null>(null);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // the photo upright (as the camera held it), for both the preview and the square that is sent
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let opened: { bitmap: ImageBitmap; url: string } | null = null;
    createImageBitmap(file, { imageOrientation: "from-image" })
      .then((bitmap) => {
        if (cancelled) return bitmap.close();
        opened = { bitmap, url: URL.createObjectURL(file) };
        setImage(opened);
        setView(initialView(bitmap.width, bitmap.height, FRAME));
        setZoom(1);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error(t("unreadable"));
        onClose();
      });
    return () => {
      cancelled = true;
      if (opened) {
        opened.bitmap.close();
        URL.revokeObjectURL(opened.url);
      }
      setImage(null);
      setView(null);
    };
  }, [file, onClose, t]);

  const w = image?.bitmap.width ?? 1;
  const h = image?.bitmap.height ?? 1;
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !view) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setView(clampView({ ...view, x: view.x + dx, y: view.y + dy }, w, h, FRAME));
  };

  const save = async () => {
    if (!image || !view) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUT;
      const { sx, sy, size } = sourceSquare(view, FRAME);
      canvas.getContext("2d")!.drawImage(image.bitmap, sx, sy, size, size, 0, 0, OUT, OUT);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error(t("unreadable"));
      const user = await accountApi.setPhoto(account.token, blob);
      saveAccount({ token: account.token, user });
      // the leagues' player lists carry the photo
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey.includes("players") || q.queryKey[0] === "auth-boards" || q.queryKey[0] === "members",
      });
      toast.success(t("saved"));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!file} onClose={onClose} labelledBy="photo-title">
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 id="photo-title" className="text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted">{t("hint")}</p>
        </div>
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          className="relative mx-auto touch-none overflow-hidden rounded-2xl bg-surface-2 select-none"
          style={{ width: FRAME, height: FRAME, cursor: "grab" }}
        >
          {image && view && (
            <img
              src={image.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ left: view.x, top: view.y, width: w * view.scale, height: h * view.scale }}
            />
          )}
          {/* what stays: the circle; the corners are dimmed */}
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(4,6,10,.6)] ring-2 ring-white/70" />
        </div>
        <label className="flex items-center gap-3 text-sm text-muted">
          {t("zoom")}
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            disabled={!view}
            onChange={(e) => {
              const z = Number(e.target.value);
              setZoom(z);
              if (view) setView(zoomView(view, z, w, h, FRAME));
            }}
            className="range flex-1"
            style={{ ["--fill" as string]: `${((zoom - 1) / 2) * 100}%` }}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="primary" loading={busy} disabled={!view} onClick={save}>
            {t("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
