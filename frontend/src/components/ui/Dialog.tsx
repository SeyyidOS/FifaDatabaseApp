import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./primitives";
import { useT } from "../../hooks/useI18n";
import { common } from "../../lib/messages";

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby={labelledBy}
            className="card relative w-full max-w-md p-6"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  const tc = useT(common);
  return (
    <Modal open={open} onClose={onClose} labelledBy="confirm-title">
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-loss/12 text-loss ring-1 ring-loss/25">
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 id="confirm-title" className="font-semibold">
            {title}
          </h3>
          {description && <div className="mt-1.5 text-sm text-muted">{description}</div>}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button
          className="bg-loss text-white hover:bg-loss/90 border-transparent"
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel ?? tc("delete")}
        </Button>
      </div>
    </Modal>
  );
}
